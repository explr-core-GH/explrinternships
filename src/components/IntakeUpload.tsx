import { useState, useCallback } from 'react';
import { Upload, ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/useAppStore';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';
import { normalizeName } from '@/lib/appointmentMatching';

interface IntakeRow {
  firstName: string;
  lastName: string;
  gender: string;
  raceEthnicity: string;
  parentGuardianEmail: string;
  parentGuardianPhone: string;
}

function findColumn(headers: string[], ...searches: string[]): number {
  for (const search of searches) {
    const idx = headers.findIndex(h => h && h.toLowerCase().includes(search.toLowerCase()));
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseIntakeFile(data: ArrayBuffer): IntakeRow[] {
  const wb = XLSX.read(data, { type: 'array' });
  const results: IntakeRow[] = [];

  // Use first sheet
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return results;

  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  if (rows.length < 2) return results;

  // Find header row
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const cells = (rows[i] || []).map(c => String(c ?? '').toLowerCase());
    const text = cells.join(' ');
    if (text.includes('first name') || text.includes('yp first')) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return results;

  const headers = rows[headerIdx].map(h => String(h ?? ''));
  const firstIdx = findColumn(headers, 'yp first name', 'first name');
  const lastIdx = findColumn(headers, 'yp last name', 'last name');
  const genderIdx = findColumn(headers, 'assigned sex', 'gender', 'sex');
  const raceIdx = findColumn(headers, 'race and ethnicity', 'race', 'ethnicity');
  const pgEmailIdx = findColumn(headers, 'parent/guardian email', 'guardian email', 'pg email');
  const pgPhoneIdx = findColumn(headers, 'parent/guardian phone', 'guardian phone', 'pg phone');

  if (firstIdx < 0 || lastIdx < 0) return results;

  for (const row of rows.slice(headerIdx + 1)) {
    if (!row || row.every(c => !String(c ?? '').trim())) continue;

    const firstName = String(row[firstIdx] ?? '').trim();
    const lastName = String(row[lastIdx] ?? '').trim();
    if (!firstName || !lastName) continue;

    const gender = genderIdx >= 0 ? String(row[genderIdx] ?? '').trim() : '';
    const raceEthnicity = raceIdx >= 0 ? String(row[raceIdx] ?? '').trim() : '';
    const parentGuardianEmail = pgEmailIdx >= 0 ? String(row[pgEmailIdx] ?? '').trim() : '';
    const parentGuardianPhone = pgPhoneIdx >= 0 ? String(row[pgPhoneIdx] ?? '').trim() : '';

    results.push({ firstName, lastName, gender, raceEthnicity, parentGuardianEmail, parentGuardianPhone });
  }

  return results;
}

export default function IntakeUpload() {
  const { fetchInterns } = useAppStore();
  const [uploading, setUploading] = useState(false);

  const handleFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      await fetchInterns();
      const activeInterns = useAppStore.getState().interns.filter(i => i.isNewest);

      const data = await file.arrayBuffer();
      const parsed = parseIntakeFile(data);

      if (parsed.length === 0) {
        toast.error('No intake data found. Make sure the file has First Name and Last Name columns.');
        setUploading(false);
        return;
      }

      let matched = 0;
      let unmatched = 0;

      for (const row of parsed) {
        const normFirst = normalizeName(row.firstName);
        const normLast = normalizeName(row.lastName);

        const match = activeInterns.find(i =>
          normalizeName(i.firstName) === normFirst &&
          normalizeName(i.lastName) === normLast
        );

        if (match) {
          const updates: Record<string, any> = {};
          if (row.gender) updates.gender = row.gender;
          if (row.raceEthnicity) updates.race_ethnicity = row.raceEthnicity;
          if (row.parentGuardianEmail) updates.parent_guardian_email = row.parentGuardianEmail;
          if (row.parentGuardianPhone) updates.parent_guardian_phone = row.parentGuardianPhone;

          if (Object.keys(updates).length > 0) {
            await supabase.from('interns').update(updates as any).eq('id', match.id);
            matched++;
          }
        } else {
          unmatched++;
        }
      }

      await fetchInterns();
      toast.success(`Updated ${matched} students${unmatched > 0 ? `, ${unmatched} not matched` : ''}`);
    } catch (error: any) {
      toast.error(`Failed to parse file: ${error.message || 'Unknown error'}`);
    }

    setUploading(false);
    event.target.value = '';
  }, [fetchInterns]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ClipboardCheck className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-medium text-foreground">Upload Intake Report</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Upload a TTP Intake Status Report to add gender, race/ethnicity, and parent/guardian info. Students are matched by name.
      </p>

      <label className="block">
        <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" disabled={uploading} />
        <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer" asChild disabled={uploading}>
          <span>
            <Upload className="h-3.5 w-3.5" />
            {uploading ? 'Processing...' : 'Choose Intake File'}
          </span>
        </Button>
      </label>
    </div>
  );
}
