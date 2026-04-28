import { useState, useCallback } from 'react';
import { Upload, Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/useAppStore';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';
import { normalizeName } from '@/lib/appointmentMatching';

function findColumn(headers: string[], ...searches: string[]): number {
  for (const search of searches) {
    const idx = headers.findIndex(h => h && h.toLowerCase().includes(search.toLowerCase()));
    if (idx >= 0) return idx;
  }
  return -1;
}

function isEllValue(value: string): boolean | null {
  const v = value.trim().toLowerCase();
  if (!v) return null;
  if (['y', 'yes', 'true', '1', 'ell', 'esl', 'x'].includes(v)) return true;
  if (['n', 'no', 'false', '0', 'non-ell', 'none'].includes(v)) return false;
  return null;
}

function parseEllFile(data: ArrayBuffer): { firstName: string; lastName: string; isEll: boolean }[] {
  const wb = XLSX.read(data, { type: 'array' });
  const results: { firstName: string; lastName: string; isEll: boolean }[] = [];

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (rows.length < 1) continue;

    let headerIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const cells = (rows[i] || []).map(c => String(c ?? '').toLowerCase());
      const text = cells.join(' ');
      if (text.includes('name')) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx < 0) continue;

    const headers = rows[headerIdx].map(h => String(h ?? ''));
    const firstIdx = findColumn(headers, 'first name', 'first');
    const lastIdx = findColumn(headers, 'last name', 'last');
    const fullIdx = (firstIdx >= 0 && lastIdx >= 0) ? -1 : findColumn(headers, 'full name', 'student name', 'name');
    const ellIdx = findColumn(headers, 'ell', 'esl', 'english language', 'language learner');

    for (const row of rows.slice(headerIdx + 1)) {
      if (!row || row.every(c => !String(c ?? '').trim())) continue;

      let firstName = firstIdx >= 0 ? String(row[firstIdx] ?? '').trim() : '';
      let lastName = lastIdx >= 0 ? String(row[lastIdx] ?? '').trim() : '';
      if (!firstName && !lastName && fullIdx >= 0) {
        const parts = String(row[fullIdx] ?? '').trim().split(/\s+/);
        firstName = parts[0] || '';
        lastName = parts.length > 1 ? parts[parts.length - 1] : '';
      }
      if (!firstName) continue;

      // If an ELL column exists, parse its value. Otherwise assume every listed student is ELL.
      let isEll = true;
      if (ellIdx >= 0) {
        const parsed = isEllValue(String(row[ellIdx] ?? ''));
        if (parsed === null) continue;
        isEll = parsed;
      }

      results.push({ firstName, lastName, isEll });
    }

    if (results.length > 0) break;
  }

  return results;
}

export default function EllUpload() {
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
      const parsed = parseEllFile(data);

      if (parsed.length === 0) {
        toast.error('No ELL data found. Make sure the file has name columns (and optionally an ELL/ESL column).');
        setUploading(false);
        return;
      }

      let matched = 0;
      const unmatchedNames: string[] = [];

      for (const row of parsed) {
        const normFirst = normalizeName(row.firstName);
        const normLast = normalizeName(row.lastName);

        const match = activeInterns.find(i =>
          normalizeName(i.firstName) === normFirst &&
          (normLast === '' || normalizeName(i.lastName) === normLast)
        );

        if (match) {
          await supabase.from('interns').update({ is_ell: row.isEll } as any).eq('id', match.id);
          matched++;
        } else {
          unmatchedNames.push(`${row.firstName} ${row.lastName}`.trim());
        }
      }

      await fetchInterns();
      const unmatched = unmatchedNames.length;
      toast.success(`ELL status updated for ${matched} student${matched === 1 ? '' : 's'}${unmatched > 0 ? `, ${unmatched} not matched` : ''}`);
      if (unmatched > 0 && unmatched <= 10) {
        toast.message('Not matched', { description: unmatchedNames.join(', ') });
      }
    } catch (error: any) {
      toast.error(`Failed to parse file: ${error.message || 'Unknown error'}`);
    }

    setUploading(false);
    event.target.value = '';
  }, [fetchInterns]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Languages className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-medium text-foreground">Upload ELL Students</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Upload an Excel file listing English Language Learners. Include first/last name columns (or a full name column). If there's no ELL/ESL column, every listed student will be marked as ELL. Students are matched by name.
      </p>

      <label className="block">
        <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" disabled={uploading} />
        <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer" asChild disabled={uploading}>
          <span>
            <Upload className="h-3.5 w-3.5" />
            {uploading ? 'Processing...' : 'Choose ELL File'}
          </span>
        </Button>
      </label>
    </div>
  );
}