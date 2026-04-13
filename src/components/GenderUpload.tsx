import { useState, useCallback } from 'react';
import { Upload, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/useAppStore';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';
import { normalizeName } from '@/lib/appointmentMatching';

interface GenderMatch {
  firstName: string;
  lastName: string;
  gender: string;
  internId: string | null;
  internName: string | null;
}

function findColumn(headers: string[], ...searches: string[]): number {
  for (const search of searches) {
    const idx = headers.findIndex(h => h && h.toLowerCase().includes(search.toLowerCase()));
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseGenderFile(data: ArrayBuffer): { firstName: string; lastName: string; gender: string }[] {
  const wb = XLSX.read(data, { type: 'array' });
  const results: { firstName: string; lastName: string; gender: string }[] = [];

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (rows.length < 2) continue;

    let headerIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const cells = (rows[i] || []).map(c => String(c ?? '').toLowerCase());
      const text = cells.join(' ');
      if (text.includes('name') && (text.includes('gender') || text.includes('sex'))) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx < 0) continue;

    const headers = rows[headerIdx].map(h => String(h ?? ''));
    const firstIdx = findColumn(headers, 'first name', 'first');
    const lastIdx = findColumn(headers, 'last name', 'last');
    const fullIdx = (firstIdx >= 0 && lastIdx >= 0) ? -1 : findColumn(headers, 'full name', 'student name', 'name');
    const genderIdx = findColumn(headers, 'gender', 'sex');
    if (genderIdx < 0) continue;

    for (const row of rows.slice(headerIdx + 1)) {
      if (!row || row.every(c => !String(c ?? '').trim())) continue;

      let firstName = firstIdx >= 0 ? String(row[firstIdx] ?? '').trim() : '';
      let lastName = lastIdx >= 0 ? String(row[lastIdx] ?? '').trim() : '';
      if (!firstName && !lastName && fullIdx >= 0) {
        const parts = String(row[fullIdx] ?? '').trim().split(/\s+/);
        firstName = parts[0] || '';
        lastName = parts.length > 1 ? parts[parts.length - 1] : '';
      }
      const gender = String(row[genderIdx] ?? '').trim();
      if (!firstName || !gender) continue;

      results.push({ firstName, lastName, gender });
    }

    if (results.length > 0) break;
  }

  return results;
}

export default function GenderUpload() {
  const { interns, fetchInterns } = useAppStore();
  const [uploading, setUploading] = useState(false);

  const handleFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Ensure interns are loaded
      await fetchInterns();
      const activeInterns = useAppStore.getState().interns.filter(i => i.isNewest);

      const data = await file.arrayBuffer();
      const parsed = parseGenderFile(data);

      if (parsed.length === 0) {
        toast.error('No gender data found. Make sure file has name and gender/sex columns.');
        setUploading(false);
        return;
      }

      // Match each row to an intern
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
          await supabase.from('interns').update({ gender: row.gender } as any).eq('id', match.id);
          matched++;
        } else {
          unmatched++;
        }
      }

      await fetchInterns();
      toast.success(`Gender updated for ${matched} students${unmatched > 0 ? `, ${unmatched} not matched` : ''}`);
    } catch (error: any) {
      toast.error(`Failed to parse file: ${error.message || 'Unknown error'}`);
    }

    setUploading(false);
    event.target.value = '';
  }, [fetchInterns]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-medium text-foreground">Upload Gender Data</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Upload an Excel file with first name, last name, and gender/sex columns. Students are matched by name.
      </p>

      <label className="block">
        <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" disabled={uploading} />
        <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer" asChild disabled={uploading}>
          <span>
            <Upload className="h-3.5 w-3.5" />
            {uploading ? 'Processing...' : 'Choose Gender File'}
          </span>
        </Button>
      </label>
    </div>
  );
}
