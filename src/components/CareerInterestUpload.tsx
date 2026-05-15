import { useState, useCallback } from 'react';
import { Upload, Briefcase, Check, X, UserPlus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAppStore } from '@/store/useAppStore';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';
import { normalizeName } from '@/lib/appointmentMatching';
import type { Intern } from '@/types/intern';

/**
 * Uploader for the "Not Selected Youth" / general career-interest report.
 * It pulls the free-text "Career Interests" column for each student and
 * appends it to their `specific_interests` so worksite matching has a
 * signal for kids who never filled out the Yes/Maybe/No interest form.
 */

interface ParsedRow {
  firstName: string;
  lastName: string;
  careerInterests: string;
}

interface MatchRow {
  parsed: ParsedRow;
  internId: string;
  internName: string;
  similarity: number;
  approved?: boolean;
  addedAsNew?: boolean;
}

function similarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ta = new Set(na.split(' ').filter(Boolean));
  const tb = new Set(nb.split(' ').filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  const overlap = [...ta].filter(t => tb.has(t)).length;
  return overlap / Math.max(ta.size, tb.size);
}

function findBest(parsed: ParsedRow, interns: Intern[]): { id: string; name: string; score: number } | null {
  let best: { id: string; name: string; score: number } | null = null;
  for (const i of interns) {
    const fs = similarity(parsed.firstName, i.firstName);
    const ls = similarity(parsed.lastName, i.lastName);
    const score = fs * 0.4 + ls * 0.6;
    if (!best || score > best.score) {
      best = { id: i.id, name: `${i.firstName} ${i.lastName}`, score };
    }
  }
  return best;
}

function cleanText(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, ', ')
    .replace(/\r?\n+/g, ', ')
    .replace(/\s*,\s*,\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseFile(data: ArrayBuffer): ParsedRow[] {
  const wb = XLSX.read(data, { type: 'array' });
  const out: ParsedRow[] = [];
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    let headerIdx = -1;
    const norm = (s: any) => String(s ?? '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
    const isCareerHeader = (c: string) =>
      c.includes('career interest') || c.includes('career interests') ||
      c === 'interests' || c === 'interest' ||
      c.includes('interested in') || c.includes('areas of interest') ||
      c.includes('career') && c.includes('interest');
    const isNameHeader = (c: string) => c === 'name' || c === 'student name' || c === 'full name' || c === 'student';
    for (let i = 0; i < Math.min(rows.length, 30); i++) {
      const cells = (rows[i] || []).map(norm);
      const hasFirstLast = cells.some(c => c.includes('first name')) && cells.some(c => c.includes('last name'));
      const hasName = cells.some(isNameHeader);
      const hasCareer = cells.some(isCareerHeader);
      if (hasCareer && (hasFirstLast || hasName)) { headerIdx = i; break; }
    }
    if (headerIdx < 0) continue;
    const headersN = (rows[headerIdx] || []).map(norm);
    const firstIdx = headersN.findIndex(h => h.includes('first name'));
    const lastIdx  = headersN.findIndex(h => h.includes('last name'));
    const nameIdx  = headersN.findIndex(isNameHeader);
    const careerIdx = headersN.findIndex(isCareerHeader);
    if (careerIdx < 0 || (firstIdx < 0 && nameIdx < 0)) continue;

    for (const row of rows.slice(headerIdx + 1)) {
      if (!row) continue;
      let firstName = '';
      let lastName = '';
      if (firstIdx >= 0 && lastIdx >= 0) {
        firstName = String(row[firstIdx] ?? '').trim();
        lastName = String(row[lastIdx] ?? '').trim();
      } else if (nameIdx >= 0) {
        const full = String(row[nameIdx] ?? '').trim();
        if (full.includes(',')) {
          const [l, f] = full.split(',').map(s => s.trim());
          firstName = f || ''; lastName = l || '';
        } else {
          const parts = full.split(/\s+/);
          firstName = parts.shift() || '';
          lastName = parts.join(' ');
        }
      }
      const career = cleanText(String(row[careerIdx] ?? ''));
      if (!firstName || !lastName || !career) continue;
      out.push({ firstName, lastName, careerInterests: career });
    }
  }
  return out;
}

export default function CareerInterestUpload() {
  const { fetchInterns, addIntern } = useAppStore();
  const [uploading, setUploading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [reviewRows, setReviewRows] = useState<MatchRow[]>([]);
  const [autoApplied, setAutoApplied] = useState(0);

  const reset = () => {
    setReviewRows([]);
    setAutoApplied(0);
  };

  const applyToIntern = async (internId: string, parsed: ParsedRow) => {
    const { data } = await supabase.from('interns').select('specific_interests').eq('id', internId).single();
    const existing = (data as any)?.specific_interests?.trim() || '';
    const stamped = `[Career Interests] ${parsed.careerInterests}`;
    // Avoid duplicate appends if same text already present
    const next = existing.includes(parsed.careerInterests) ? existing : (existing ? `${existing}\n${stamped}` : stamped);
    await supabase.from('interns').update({ specific_interests: next } as any).eq('id', internId);
  };

  const handleFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    reset();
    try {
      await fetchInterns();
      const interns = useAppStore.getState().interns.filter(i => i.isNewest);
      const buffer = await file.arrayBuffer();
      const rows = parseFile(buffer);
      if (rows.length === 0) {
        toast.error('No career-interest rows found. File needs First Name, Last Name, and Career Interests columns.');
        setUploading(false);
        event.target.value = '';
        return;
      }
      let auto = 0;
      const review: MatchRow[] = [];
      for (const row of rows) {
        const best = findBest(row, interns);
        if (best && best.score >= 0.95) {
          await applyToIntern(best.id, row);
          auto++;
        } else if (best) {
          review.push({ parsed: row, internId: best.id, internName: best.name, similarity: best.score });
        } else {
          review.push({ parsed: row, internId: '', internName: 'No roster match', similarity: 0 });
        }
      }
      setAutoApplied(auto);
      setReviewRows(review);
      await fetchInterns();
      if (auto > 0) toast.success(`Applied career interests to ${auto} student${auto === 1 ? '' : 's'}`);
      if (review.length > 0) toast.message(`Review ${review.length} possible match${review.length === 1 ? '' : 'es'}`);
      if (auto === 0 && review.length === 0) toast.warning('No matches found');
    } catch (err: any) {
      toast.error(`Failed to parse file: ${err.message || 'Unknown error'}`);
    }
    setUploading(false);
    event.target.value = '';
  }, [fetchInterns]);

  const handleApprove = (i: number) =>
    setReviewRows(prev => prev.map((r, idx) => idx === i ? { ...r, approved: true } : r));
  const handleReject = (i: number) =>
    setReviewRows(prev => prev.map((r, idx) => idx === i ? { ...r, approved: false } : r));
  const handleAddNew = async (i: number) => {
    const r = reviewRows[i];
    if (!r || r.addedAsNew) return;
    const created = await addIntern({ firstName: r.parsed.firstName, lastName: r.parsed.lastName });
    if (!created) {
      toast.error(`Failed to add ${r.parsed.firstName} ${r.parsed.lastName}`);
      return;
    }
    await applyToIntern(created.id, r.parsed);
    setReviewRows(prev => prev.map((row, idx) => idx === i
      ? { ...row, addedAsNew: true, internId: created.id, internName: `${created.firstName} ${created.lastName}`, similarity: 1, approved: false }
      : row));
    toast.success(`Added ${r.parsed.firstName} ${r.parsed.lastName} with career interests`);
  };

  const handleApply = async () => {
    setApplying(true);
    let updated = 0;
    for (const r of reviewRows) {
      if (r.approved === true && r.internId && !r.addedAsNew) {
        await applyToIntern(r.internId, r.parsed);
        updated++;
      }
    }
    await fetchInterns();
    setApplying(false);
    if (updated > 0) toast.success(`Updated ${updated} student${updated === 1 ? '' : 's'}`);
    reset();
  };

  const approvedCount = reviewRows.filter(r => r.approved === true).length;
  const addedCount = reviewRows.filter(r => r.addedAsNew).length;
  const canFinish = approvedCount > 0 || addedCount > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Briefcase className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-medium text-foreground">Upload Career Interests</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Upload the YOU "Not Selected" or any roster export with a <span className="font-medium">Career Interests</span> column. The free-text career interest is appended to each matched student's specific interests so worksite matching has a signal even when the Yes/Maybe/No interest form is missing.
      </p>

      <label className="block">
        <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" disabled={uploading || applying} />
        <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer" asChild disabled={uploading || applying}>
          <span>
            <Upload className="h-3.5 w-3.5" />
            {uploading ? 'Processing...' : 'Choose Career Interests File'}
          </span>
        </Button>
      </label>

      {(autoApplied > 0 || reviewRows.length > 0) && (
        <div className="text-xs text-muted-foreground">
          {autoApplied > 0 && <>Auto-applied to <span className="font-medium text-foreground">{autoApplied}</span> student(s). </>}
          {reviewRows.length > 0 && <>Review {reviewRows.length} possible match{reviewRows.length === 1 ? '' : 'es'} below.</>}
        </div>
      )}

      {reviewRows.length > 0 && (
        <>
          <div className="border rounded-lg bg-card">
            <ScrollArea className="h-[360px] w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Uploaded Name</TableHead>
                    <TableHead>Career Interests</TableHead>
                    <TableHead>Best Match</TableHead>
                    <TableHead className="w-12">%</TableHead>
                    <TableHead className="w-[120px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reviewRows.map((r, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{r.parsed.firstName} {r.parsed.lastName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[260px]">{r.parsed.careerInterests}</TableCell>
                      <TableCell className="text-sm">{r.internName}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          r.similarity >= 0.7 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                          : r.similarity >= 0.4 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                        }`}>{Math.round(r.similarity * 100)}%</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" title="Approve match" variant={r.approved === true ? 'default' : 'outline'} onClick={() => handleApprove(idx)} disabled={r.addedAsNew || !r.internId} className="h-7 w-7 p-0">
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button size="sm" title="Reject" variant={r.approved === false ? 'destructive' : 'outline'} onClick={() => handleReject(idx)} disabled={r.addedAsNew} className="h-7 w-7 p-0">
                            <X className="h-3 w-3" />
                          </Button>
                          <Button size="sm" title={r.addedAsNew ? 'Added as new student' : 'Add as new student'} variant={r.addedAsNew ? 'secondary' : 'outline'} onClick={() => handleAddNew(idx)} disabled={r.addedAsNew} className="h-7 w-7 p-0">
                            <UserPlus className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleApply} disabled={applying || !canFinish} className="flex-1">
              {applying ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
              {approvedCount > 0 ? `Apply ${approvedCount} Approved` : 'Finish Review'}
            </Button>
            <Button variant="outline" onClick={reset} disabled={applying}>Cancel</Button>
          </div>
        </>
      )}
    </div>
  );
}