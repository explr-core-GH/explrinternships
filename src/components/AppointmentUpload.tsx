import { useState, useCallback } from 'react';
import { Upload, CalendarClock, CheckCircle2, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/useAppStore';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface ParsedAppointment {
  firstName: string;
  lastName: string;
  date: string;
  time: string;
  location: string;
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[''`\-]/g, '').replace(/[^\w]/g, '').trim();
}

function findColumn(headers: string[], ...searches: string[]): number {
  for (const search of searches) {
    const idx = headers.findIndex(h => h && h.toLowerCase().includes(search.toLowerCase()));
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseAppointmentFile(data: ArrayBuffer): ParsedAppointment[] {
  const wb = XLSX.read(data, { type: 'array' });
  const results: ParsedAppointment[] = [];

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (rows.length < 2) continue;

    // Find header row
    let headerIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const cells = (rows[i] || []).map((c: any) => String(c ?? '').toLowerCase());
      const rowStr = cells.join(' ');
      if (rowStr.includes('name') && (rowStr.includes('date') || rowStr.includes('time') || rowStr.includes('appointment'))) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx < 0) continue;

    const headers = rows[headerIdx].map((h: any) => String(h ?? ''));
    const dataRows = rows.slice(headerIdx + 1);

    const firstNameIdx = findColumn(headers, 'first name');
    const lastNameIdx = findColumn(headers, 'last name');
    const fullNameIdx = findColumn(headers, 'full name', 'student name', 'youth name', 'name');
    const dateIdx = findColumn(headers, 'date', 'appointment date', 'intake date');
    const timeIdx = findColumn(headers, 'time', 'appointment time', 'intake time');
    const locationIdx = findColumn(headers, 'location', 'site', 'place', 'where', 'notes');

    for (const row of dataRows) {
      if (!row || row.every((c: any) => !String(c ?? '').trim())) continue;

      let firstName = '', lastName = '';
      if (firstNameIdx >= 0 && lastNameIdx >= 0) {
        firstName = String(row[firstNameIdx] ?? '').trim();
        lastName = String(row[lastNameIdx] ?? '').trim();
      } else if (fullNameIdx >= 0) {
        const full = String(row[fullNameIdx] ?? '').trim();
        const parts = full.split(/\s+/);
        firstName = parts[0] || '';
        lastName = parts.slice(1).join(' ') || '';
      }

      if (!firstName || !lastName) continue;

      let dateVal = '';
      if (dateIdx >= 0) {
        const raw = row[dateIdx];
        if (raw instanceof Date) {
          dateVal = raw.toLocaleDateString();
        } else if (typeof raw === 'number') {
          // Excel serial date
          const d = XLSX.SSF.parse_date_code(raw);
          if (d) dateVal = `${d.m}/${d.d}/${d.y}`;
        } else {
          dateVal = String(raw ?? '').trim();
        }
      }

      let timeVal = '';
      if (timeIdx >= 0) {
        const raw = row[timeIdx];
        if (typeof raw === 'number' && raw < 1) {
          // Excel fractional time
          const totalMinutes = Math.round(raw * 24 * 60);
          const h = Math.floor(totalMinutes / 60);
          const m = totalMinutes % 60;
          const ampm = h >= 12 ? 'PM' : 'AM';
          const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
          timeVal = `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
        } else {
          timeVal = String(raw ?? '').trim();
        }
      }

      // If date and time might be combined in one column
      if (!timeVal && dateVal.includes(' ')) {
        const parts = dateVal.split(/\s+/);
        if (parts.length >= 2 && (parts[parts.length - 1].includes('AM') || parts[parts.length - 1].includes('PM') || parts[parts.length - 1].includes(':'))) {
          // Last part(s) look like time
          const dateP = parts.slice(0, -2).join(' ') || parts[0];
          const timeP = parts.slice(-2).join(' ') || parts.slice(-1).join(' ');
          dateVal = dateP;
          timeVal = timeP;
        }
      }

      results.push({
        firstName,
        lastName,
        date: dateVal,
        time: timeVal,
        location: locationIdx >= 0 ? String(row[locationIdx] ?? '').trim() : '',
      });
    }
    if (results.length > 0) break;
  }
  return results;
}

export default function AppointmentUpload() {
  const { interns, fetchInterns } = useAppStore();
  const [results, setResults] = useState<{ matched: number; unmatched: string[] } | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setResults(null);

    try {
      const data = await file.arrayBuffer();
      const appointments = parseAppointmentFile(data);

      if (appointments.length === 0) {
        toast.error('No appointment data found. Make sure the file has columns for name, date, and time.');
        setUploading(false);
        return;
      }

      let matched = 0;
      const unmatched: string[] = [];

      for (const appt of appointments) {
        const normFirst = normalizeName(appt.firstName);
        const normLast = normalizeName(appt.lastName);

        const intern = interns.find(i =>
          normalizeName(i.firstName) === normFirst &&
          normalizeName(i.lastName) === normLast
        );

        if (intern) {
          await supabase.from('interns').update({
            intake_date: appt.date || null,
            intake_time: appt.time || null,
            intake_location: appt.location || null,
          }).eq('id', intern.id);
          matched++;
        } else {
          unmatched.push(`${appt.firstName} ${appt.lastName}`);
        }
      }

      await fetchInterns();
      setResults({ matched, unmatched });
      toast.success(`Matched ${matched} of ${appointments.length} appointments`);
    } catch (err: any) {
      toast.error('Failed to parse file: ' + (err.message || 'Unknown error'));
    }
    setUploading(false);
    e.target.value = '';
  }, [interns, fetchInterns]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-medium text-foreground">Upload Intake Appointments</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Upload an Excel file with student names, appointment dates, times, and locations. Students are matched by first + last name.
      </p>

      <label className="block">
        <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" disabled={uploading} />
        <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer" asChild disabled={uploading}>
          <span>
            <Upload className="h-3.5 w-3.5" />
            {uploading ? 'Processing...' : 'Choose Appointment File'}
          </span>
        </Button>
      </label>

      {results && (
        <div className="rounded-md border p-3 space-y-2 bg-muted/30">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <span className="text-foreground font-medium">{results.matched} students matched</span>
          </div>
          {results.unmatched.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <span className="text-warning font-medium">{results.unmatched.length} not matched:</span>
              </div>
              <ul className="text-xs text-muted-foreground pl-6 list-disc">
                {results.unmatched.map((name, i) => <li key={i}>{name}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
