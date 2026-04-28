import { useState, useCallback } from 'react';
import { Upload, School } from 'lucide-react';
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

function isCmsdValue(value: string): boolean | null {
  const v = value.trim().toLowerCase();
  if (!v) return null;
  if (['y', 'yes', 'true', '1', 'cmsd', 'x'].includes(v)) return true;
  if (['n', 'no', 'false', '0', 'non-cmsd', 'none'].includes(v)) return false;
  return null;
}

function parseCmsdFile(data: ArrayBuffer): { firstName: string; lastName: string; isCmsd: boolean }[] {
  const wb = XLSX.read(data, { type: 'array' });
  const results: { firstName: string; lastName: string; isCmsd: boolean }[] = [];

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
    const cmsdIdx = findColumn(headers, 'cmsd', 'cleveland metropolitan', 'district');

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

      // If a CMSD column exists, parse Yes/No. Otherwise assume every listed student is CMSD.
      let isCmsd = true;
      if (cmsdIdx >= 0) {
        const parsed = isCmsdValue(String(row[cmsdIdx] ?? ''));
        if (parsed === null) continue;
        isCmsd = parsed;
      }

      results.push({ firstName, lastName, isCmsd });
    }

    if (results.length > 0) break;
  }

  return results;
}

export default function CmsdUpload() {
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
      const parsed = parseCmsdFile(data);

      if (parsed.length === 0) {
        toast.error('No CMSD data found. Make sure the file has name columns (and optionally a CMSD Yes/No column).');
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
          await supabase.from('interns').update({ is_cmsd: row.isCmsd } as any).eq('id', match.id);
          matched++;
        } else {
          unmatchedNames.push(`${row.firstName} ${row.lastName}`.trim());
        }
      }

      await fetchInterns();
      const unmatched = unmatchedNames.length;
      toast.success(`CMSD status updated for ${matched} student${matched === 1 ? '' : 's'}${unmatched > 0 ? `, ${unmatched} not matched` : ''}`);
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
        <School className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-medium text-foreground">Upload CMSD Students</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Upload an Excel file indicating which students attend a CMSD (Cleveland Metropolitan School District) school. Include first/last name columns and a CMSD column with Yes/No values. Students are matched by name.
      </p>

      <label className="block">
        <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" disabled={uploading} />
        <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer" asChild disabled={uploading}>
          <span>
            <Upload className="h-3.5 w-3.5" />
            {uploading ? 'Processing...' : 'Choose CMSD File'}
          </span>
        </Button>
      </label>
    </div>
  );
}