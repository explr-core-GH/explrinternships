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
  dob: string;
  email: string;
  date: string;
  time: string;
  location: string;
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[''`\-]/g, '').replace(/[^\w]/g, '').trim();
}

function normalizeDob(dob: string | number): string {
  if (!dob && dob !== 0) return '';
  // Handle Excel serial date numbers
  if (typeof dob === 'number') {
    const d = XLSX.SSF.parse_date_code(dob);
    if (d) return `${d.m}/${d.d}/${d.y}`;
    return '';
  }
  const cleaned = String(dob).trim();
  if (!cleaned) return '';
  // Try to parse common date formats and normalize to M/D/YYYY
  const parts = cleaned.split(/[\/\-\.]/);
  if (parts.length === 3) {
    const m = parseInt(parts[0], 10);
    const d = parseInt(parts[1], 10);
    const y = parseInt(parts[2], 10);
    if (!isNaN(m) && !isNaN(d) && !isNaN(y)) {
      const fullYear = y < 100 ? (y > 50 ? 1900 + y : 2000 + y) : y;
      return `${m}/${d}/${fullYear}`;
    }
  }
  return cleaned.toLowerCase();
}

function findColumn(headers: string[], ...searches: string[]): number {
  for (const search of searches) {
    const idx = headers.findIndex(h => h && h.toLowerCase().includes(search.toLowerCase()));
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseExcelDate(raw: any): string {
  if (raw instanceof Date) return raw.toLocaleDateString();
  if (typeof raw === 'number') {
    const d = XLSX.SSF.parse_date_code(raw);
    if (d) return `${d.m}/${d.d}/${d.y}`;
  }
  return String(raw ?? '').trim();
}

function parseExcelTime(raw: any): string {
  if (typeof raw === 'number' && raw < 1) {
    const totalMinutes = Math.round(raw * 24 * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  }
  return String(raw ?? '').trim();
}

function parseAppointmentFile(data: ArrayBuffer): ParsedAppointment[] {
  const wb = XLSX.read(data, { type: 'array' });
  const results: ParsedAppointment[] = [];

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (rows.length < 2) continue;

    let headerIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const cells = (rows[i] || []).map((c: any) => String(c ?? '').toLowerCase());
      const rowStr = cells.join(' ');
      if (rowStr.includes('name') && (rowStr.includes('date') || rowStr.includes('time') || rowStr.includes('appointment') || rowStr.includes('birth'))) {
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
    const dobIdx = findColumn(headers, 'birthdate', 'birth date', 'date of birth', 'dob', 'birthday');
    const emailIdx = findColumn(headers, 'email', 'e-mail');
    const dateIdx = findColumn(headers, 'appointment date', 'intake date', 'date');
    const timeIdx = findColumn(headers, 'time', 'appointment time', 'intake time');
    const locationIdx = findColumn(headers, 'address', 'location', 'site', 'place', 'where');

    // Avoid picking the DOB column as the date column
    const effectiveDateIdx = dateIdx === dobIdx ? -1 : dateIdx;

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

      const dobVal = dobIdx >= 0 ? parseExcelDate(row[dobIdx]) : '';
      const dobRaw = dobIdx >= 0 ? row[dobIdx] : '';
      const normalizedApptDob = normalizeDob(dobRaw || dobVal);
      const emailVal = emailIdx >= 0 ? String(row[emailIdx] ?? '').trim() : '';
      const dateVal = effectiveDateIdx >= 0 ? parseExcelDate(row[effectiveDateIdx]) : '';

      let timeVal = timeIdx >= 0 ? parseExcelTime(row[timeIdx]) : '';

      results.push({
        firstName,
        lastName,
        dob: dobVal,
        email: emailVal,
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
        const normDob = normalizeDob(appt.dob);

        // Match by name + DOB when DOB is available, otherwise fall back to name only
        // Find all name matches, then prefer DOB match if available
        const nameMatches = interns.filter(i =>
          normalizeName(i.firstName) === normFirst && normalizeName(i.lastName) === normLast
        );

        let intern = null;
        if (nameMatches.length === 1) {
          intern = nameMatches[0];
        } else if (nameMatches.length > 1 && normDob) {
          // Multiple name matches — use DOB to disambiguate
          intern = nameMatches.find(i => i.dob && normalizeDob(i.dob) === normDob) || nameMatches[0];
        } else if (nameMatches.length > 1) {
          intern = nameMatches[0]; // take first if no DOB to disambiguate
        }

        if (intern) {
          const updateFields: Record<string, any> = {
            intake_date: appt.date || null,
            intake_time: appt.time || null,
            intake_location: appt.location || null,
          };
          // Update email from appointment file if intern doesn't have one
          if (appt.email && !intern.studentEmail) {
            updateFields.student_email = appt.email;
          }
          await supabase.from('interns').update(updateFields).eq('id', intern.id);
          matched++;
        } else {
          const label = `${appt.firstName} ${appt.lastName}${appt.dob ? ` (DOB: ${appt.dob})` : ''}`;
          unmatched.push(label);
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
        Upload an Excel file with student names, birthdates, emails, appointment dates/times, and addresses. Students are matched by name + birthdate.
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
