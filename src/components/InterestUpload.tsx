import { useState, useCallback } from 'react';
import { Upload, Heart, Check, X, UserPlus, RefreshCw } from 'lucide-react';
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
 * Maps a fragment of the form question text to the matching DB column on
 * the interns table. We intentionally only cover questions that line up
 * with existing interest fields. Unmapped questions (journalism, IT cert,
 * bikes, hardware troubleshooting, passion ranking) are appended to
 * specific_interests as a free-text note so nothing is lost.
 */
const QUESTION_TO_FIELD: { match: string; column: string; label: string }[] = [
  { match: '3d printing',                column: 'biomedical',           label: 'Biomedical (assistive devices)' },
  { match: 'nasa',                       column: 'iers_center',          label: 'NASA / IERS Center' },
  { match: 'education and/or camp',      column: 'education_internship', label: 'Education / Camp Counseling' },
  { match: 'healthcare fields',          column: 'healthcare',           label: 'Healthcare' },
  { match: 'designing your own apps',    column: 'video_games',          label: 'App / Web Design' },
  { match: 'design your own video games',column: 'video_games',          label: 'Video Game Design' },
  { match: 'environmental justice',      column: 'env_justice',          label: 'Environmental Justice' },
  { match: 'environmental science',      column: 'env_field_science',    label: 'Environmental Science' },
  { match: 'construction management',    column: 'construction_mgmt',    label: 'Construction Management' },
];

/** Question fragments that should be captured as text notes (no column). */
const QUESTION_TO_NOTE: { match: string; label: string }[] = [
  { match: 'fixing and troubleshooting', label: 'IT Hardware/Troubleshooting' },
  { match: 'journalism',                 label: 'Journalism' },
  { match: 'riding bikes',               label: 'Bikes / Outdoors' },
  { match: 'industry certification',     label: 'IT Certification' },
];

const RANKING_FRAGMENT = 'rank these';

interface ParsedRow {
  firstName: string;
  lastName: string;
  /** colName -> 'Yes' | 'No' | 'Maybe' */
  fieldAnswers: Record<string, string>;
  /** label -> answer for note-only questions */
  noteAnswers: Record<string, string>;
  ranking: string;
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

function parseInterestFile(data: ArrayBuffer): ParsedRow[] {
  const wb = XLSX.read(data, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  if (rows.length < 2) return [];

  // Find header row (must contain "First Name")
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const cells = (rows[i] || []).map((c: any) => String(c ?? '').toLowerCase());
    if (cells.some(c => c.includes('first name'))) { headerIdx = i; break; }
  }
  if (headerIdx < 0) return [];

  const headers = (rows[headerIdx] || []).map((h: any) => String(h ?? ''));
  const firstIdx = headers.findIndex(h => h.toLowerCase().includes('first name'));
  const lastIdx = headers.findIndex(h => h.toLowerCase().includes('last name'));
  if (firstIdx < 0 || lastIdx < 0) return [];

  // Build column index → mapping
  const fieldCols: { idx: number; column: string }[] = [];
  const noteCols: { idx: number; label: string }[] = [];
  let rankingIdx = -1;
  headers.forEach((h, idx) => {
    const low = h.toLowerCase();
    if (low.includes(RANKING_FRAGMENT)) { rankingIdx = idx; return; }
    const f = QUESTION_TO_FIELD.find(q => low.includes(q.match));
    if (f) { fieldCols.push({ idx, column: f.column }); return; }
    const n = QUESTION_TO_NOTE.find(q => low.includes(q.match));
    if (n) { noteCols.push({ idx, label: n.label }); }
  });

  const out: ParsedRow[] = [];
  for (const row of rows.slice(headerIdx + 1)) {
    if (!row) continue;
    const firstName = String(row[firstIdx] ?? '').trim();
    const lastName = String(row[lastIdx] ?? '').trim();
    if (!firstName && !lastName) continue;

    const fieldAnswers: Record<string, string> = {};
    for (const fc of fieldCols) {
      const val = String(row[fc.idx] ?? '').trim();
      if (val) fieldAnswers[fc.column] = val;
    }
    const noteAnswers: Record<string, string> = {};
    for (const nc of noteCols) {
      const val = String(row[nc.idx] ?? '').trim();
      if (val) noteAnswers[nc.label] = val;
    }
    const ranking = rankingIdx >= 0 ? String(row[rankingIdx] ?? '').trim() : '';

    out.push({ firstName, lastName, fieldAnswers, noteAnswers, ranking });
  }
  return out;
}

function buildNote(parsed: ParsedRow): string {
  const parts: string[] = [];
  const noteEntries = Object.entries(parsed.noteAnswers).filter(([, v]) => v);
  if (noteEntries.length > 0) {
    parts.push(noteEntries.map(([k, v]) => `${k}: ${v}`).join('; '));
  }
  if (parsed.ranking) parts.push(`Passion ranking: ${parsed.ranking}`);
  return parts.join(' | ');
}

export default function InterestUpload() {
  const { fetchInterns, addIntern } = useAppStore();
  const [uploading, setUploading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [reviewRows, setReviewRows] = useState<MatchRow[]>([]);
  const [autoApplied, setAutoApplied] = useState(0);

  const reset = () => {
    setParsed([]);
    setReviewRows([]);
    setAutoApplied(0);
  };

  const applyToIntern = async (internId: string, parsedRow: ParsedRow) => {
    const updates: Record<string, any> = { ...parsedRow.fieldAnswers };
    const note = buildNote(parsedRow);
    if (note) {
      // Append to existing specific_interests with separator
      const { data } = await supabase.from('interns').select('specific_interests').eq('id', internId).single();
      const existing = (data as any)?.specific_interests?.trim() || '';
      const stamped = `[Interest Update] ${note}`;
      updates.specific_interests = existing ? `${existing}\n${stamped}` : stamped;
    }
    await supabase.from('interns').update(updates as any).eq('id', internId);
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
      const rows = parseInterestFile(buffer);

      if (rows.length === 0) {
        toast.error('No interest data found. Make sure the file has a First Name / Last Name header row.');
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
          review.push({
            parsed: row,
            internId: best.id,
            internName: best.name,
            similarity: best.score,
          });
        } else {
          review.push({
            parsed: row,
            internId: '',
            internName: 'No roster match',
            similarity: 0,
          });
        }
      }

      setParsed(rows);
      setAutoApplied(auto);
      setReviewRows(review);
      await fetchInterns();

      if (auto > 0) toast.success(`Applied interests to ${auto} student${auto === 1 ? '' : 's'} automatically`);
      if (review.length > 0) toast.message(`Review ${review.length} possible match${review.length === 1 ? '' : 'es'}`);
      if (auto === 0 && review.length === 0) toast.warning('No matches found');
    } catch (err: any) {
      toast.error(`Failed to parse file: ${err.message || 'Unknown error'}`);
    }

    setUploading(false);
    event.target.value = '';
  }, [fetchInterns]);

  const handleApprove = (i: number) => {
    setReviewRows(prev => prev.map((r, idx) => idx === i ? { ...r, approved: true } : r));
  };
  const handleReject = (i: number) => {
    setReviewRows(prev => prev.map((r, idx) => idx === i ? { ...r, approved: false } : r));
  };
  const handleAddNew = async (i: number) => {
    const r = reviewRows[i];
    if (!r || r.addedAsNew) return;
    const created = await addIntern({
      firstName: r.parsed.firstName,
      lastName: r.parsed.lastName,
    });
    if (!created) {
      toast.error(`Failed to add ${r.parsed.firstName} ${r.parsed.lastName}`);
      return;
    }
    await applyToIntern(created.id, r.parsed);
    setReviewRows(prev => prev.map((row, idx) => idx === i
      ? { ...row, addedAsNew: true, internId: created.id, internName: `${created.firstName} ${created.lastName}`, similarity: 1, approved: false }
      : row));
    toast.success(`Added ${r.parsed.firstName} ${r.parsed.lastName} with interests`);
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
        <Heart className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-medium text-foreground">Upload Student Interest Updates</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Upload the Interest Update form (Yes / No / Maybe answers). Matched students get their interest fields updated; unmapped questions (journalism, IT cert, bikes, hardware) are appended to their notes.
      </p>

      <label className="block">
        <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" disabled={uploading || applying} />
        <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer" asChild disabled={uploading || applying}>
          <span>
            <Upload className="h-3.5 w-3.5" />
            {uploading ? 'Processing...' : 'Choose Interest File'}
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
            <ScrollArea className="h-[360px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Uploaded Name</TableHead>
                    <TableHead>Best Roster Match</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reviewRows.map((r, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{r.parsed.firstName} {r.parsed.lastName}</TableCell>
                      <TableCell className="text-sm">{r.internName}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          r.similarity >= 0.7 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                          : r.similarity >= 0.4 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                        }`}>{Math.round(r.similarity * 100)}%</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1.5">
                          <Button size="sm" variant={r.approved === true ? 'default' : 'outline'} onClick={() => handleApprove(idx)} disabled={r.addedAsNew || !r.internId} className="h-7 px-2">
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant={r.approved === false ? 'destructive' : 'outline'} onClick={() => handleReject(idx)} disabled={r.addedAsNew} className="h-7 px-2">
                            <X className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant={r.addedAsNew ? 'secondary' : 'outline'} onClick={() => handleAddNew(idx)} disabled={r.addedAsNew} className="h-7 px-2 gap-1" title="Add as new student with these interests">
                            <UserPlus className="h-3 w-3" />
                            {r.addedAsNew ? 'Added' : 'Add new'}
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