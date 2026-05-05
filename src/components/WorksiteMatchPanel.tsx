import { useMemo, useState, useCallback } from 'react';
import { Users, Sparkles, CheckSquare, Square, Loader2, AlertTriangle, X, Mail, Phone, School as SchoolIcon, GraduationCap, Filter } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { useAppStore } from '@/store/useAppStore';
import { rankInternsForWorksite } from '@/lib/worksiteMatcher';
import type { Worksite, Intern } from '@/types/intern';
import { STATUS_CONFIG, INTERN_STATUSES } from '@/types/intern';
import { cn } from '@/lib/utils';

interface WorksiteMatchPanelProps {
  worksite: Worksite | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ScoreBadge({ score }: { score: number }) {
  let className = 'bg-muted text-muted-foreground border-muted-foreground/20';
  let label = `${score}`;
  if (score >= 6) {
    className = 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-400';
    label = `★ ${score}`;
  } else if (score >= 3) {
    className = 'bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-400';
  } else if (score > 0) {
    className = 'bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400';
  } else if (score < 0) {
    className = 'bg-rose-500/15 text-rose-700 border-rose-500/30 dark:text-rose-400';
  }
  return (
    <span className={cn('text-[11px] px-2 py-0.5 rounded-full border font-semibold', className)}>
      {label}
    </span>
  );
}

export default function WorksiteMatchPanel({ worksite, open, onOpenChange }: WorksiteMatchPanelProps) {
  const { interns, assignments, assignIntern, updateIntern } = useAppStore();

  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [hideZero, setHideZero] = useState(true);
  const [excludeAssignedAnywhere, setExcludeAssignedAnywhere] = useState(true);
  const [ellOnly, setEllOnly] = useState(false);
  const [cmsdOnly, setCmsdOnly] = useState(false);
  const [autoSetStatus, setAutoSetStatus] = useState(true);
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const grades = useMemo(() => {
    const set = new Set<string>();
    interns.forEach(i => i.grade && set.add(i.grade));
    return [...set].sort();
  }, [interns]);

  const ranked = useMemo(() => {
    if (!worksite) return [];
    const list = rankInternsForWorksite(worksite, interns, assignments, {
      excludeAssignedHere: true,
      excludeAssignedAnywhere,
      minScore: hideZero ? 1 : -Infinity,
      newestOnly: true,
      enforceCapacity: false, // we surface capacity separately, don't penalize ranking here
    });
    return list.filter(m => {
      if (gradeFilter !== 'all' && m.intern.grade !== gradeFilter) return false;
      if (ellOnly && !m.intern.isEll) return false;
      if (cmsdOnly && !m.intern.isCmsd) return false;
      if (statusFilter.size > 0 && !statusFilter.has(m.intern.status)) return false;
      if (search) {
        const q = search.toLowerCase();
        const i = m.intern;
        const hay = `${i.firstName} ${i.lastName} ${i.school} ${i.studentEmail} ${i.specificInterests}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [worksite, interns, assignments, excludeAssignedAnywhere, hideZero, gradeFilter, ellOnly, cmsdOnly, statusFilter, search]);

  const remainingSlots = worksite ? Math.max(0, worksite.capacity - worksite.filled) : 0;
  const wouldOverfill = selected.size > remainingSlots;

  const toggleSelect = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const selectTopN = (n: number) => {
    setSelected(new Set(ranked.slice(0, n).map(m => m.intern.id)));
  };

  const clearSelection = () => setSelected(new Set());

  const assignSelected = async () => {
    if (!worksite || selected.size === 0) return;
    setBusy(true);
    let ok = 0;
    let failed = 0;
    for (const id of selected) {
      try {
        await assignIntern(id, worksite.id);
        if (autoSetStatus) {
          await updateIntern(id, { status: 'assigned' });
        }
        ok++;
      } catch (e) {
        console.error('assign failed for', id, e);
        failed++;
      }
    }
    setBusy(false);
    setSelected(new Set());
    if (failed === 0) {
      toast.success(`Assigned ${ok} student${ok === 1 ? '' : 's'} to ${worksite.name}`);
    } else {
      toast.warning(`${ok} assigned, ${failed} failed — check console`);
    }
  };

  const assignOne = async (intern: Intern) => {
    if (!worksite) return;
    setBusy(true);
    try {
      await assignIntern(intern.id, worksite.id);
      if (autoSetStatus) {
        await updateIntern(intern.id, { status: 'assigned' });
      }
      toast.success(`${intern.firstName} ${intern.lastName} → ${worksite.name}`);
    } catch (e) {
      console.error(e);
      toast.error('Assignment failed');
    } finally {
      setBusy(false);
    }
  };

  if (!worksite) return null;

  const pct = worksite.capacity > 0 ? (worksite.filled / worksite.capacity) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-5 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Match Students — {worksite.name}
          </DialogTitle>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{worksite.filled}/{worksite.capacity} filled</span>
            <span className="text-muted-foreground/60">·</span>
            <span>{worksite.category}</span>
            {worksite.tags?.length ? <>
              <span className="text-muted-foreground/60">·</span>
              <span className="truncate">tags: {worksite.tags.join(', ')}</span>
            </> : null}
          </div>
          <Progress value={pct} className="h-1.5 mt-2" />
        </DialogHeader>

        {/* Filters */}
        <div className="px-5 py-3 border-b bg-muted/30 space-y-2">
          <div className="flex gap-2 items-center flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search name, school, email, interests..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <select
              value={gradeFilter}
              onChange={e => setGradeFilter(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="all">All grades</option>
              {grades.map(g => <option key={g} value={g}>Grade {g}</option>)}
            </select>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <FilterPill active={hideZero} onClick={() => setHideZero(v => !v)}>
              Hide zero-score
            </FilterPill>
            <FilterPill active={excludeAssignedAnywhere} onClick={() => setExcludeAssignedAnywhere(v => !v)}>
              Exclude already assigned
            </FilterPill>
            <FilterPill active={ellOnly} onClick={() => setEllOnly(v => !v)}>
              ELL only
            </FilterPill>
            <FilterPill active={cmsdOnly} onClick={() => setCmsdOnly(v => !v)}>
              CMSD only
            </FilterPill>
            <FilterPill active={autoSetStatus} onClick={() => setAutoSetStatus(v => !v)}>
              Auto-set status → Assigned
            </FilterPill>
          </div>
          <div className="flex gap-1.5 flex-wrap items-center">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Status:</span>
            {statusFilter.size > 0 && (
              <button
                onClick={() => setStatusFilter(new Set())}
                className="text-[10px] text-muted-foreground hover:text-foreground underline"
              >
                clear
              </button>
            )}
            {INTERN_STATUSES.map(s => {
              const cfg = STATUS_CONFIG[s];
              const active = statusFilter.has(s);
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(prev => {
                    const n = new Set(prev);
                    n.has(s) ? n.delete(s) : n.add(s);
                    return n;
                  })}
                  className={cn(
                    'h-6 px-2 rounded-full text-[10px] font-medium border transition-colors',
                    active
                      ? cn(cfg.bgClass, cfg.textClass, cfg.borderClass)
                      : 'bg-card text-muted-foreground hover:text-foreground border-input',
                  )}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Bulk action bar */}
        <div className="px-5 py-2 border-b bg-card flex items-center gap-2 flex-wrap text-xs">
          <span className="text-muted-foreground">
            {ranked.length} candidate{ranked.length === 1 ? '' : 's'}
          </span>
          <span className="text-muted-foreground/60">·</span>
          <span className="text-muted-foreground">{remainingSlots} open slot{remainingSlots === 1 ? '' : 's'}</span>
          <div className="flex-1" />
          {selected.size > 0 && (
            <>
              <button onClick={clearSelection} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                <X className="h-3 w-3" /> Clear ({selected.size})
              </button>
              {wouldOverfill && (
                <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3 w-3" />
                  Selecting {selected.size}, only {remainingSlots} open
                </span>
              )}
              <Button
                size="sm"
                onClick={assignSelected}
                disabled={busy}
                className="h-7 text-xs gap-1"
              >
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckSquare className="h-3 w-3" />}
                Assign {selected.size}
              </Button>
            </>
          )}
          {selected.size === 0 && remainingSlots > 0 && ranked.length > 0 && (
            <button
              onClick={() => selectTopN(Math.min(remainingSlots, ranked.length))}
              className="text-primary hover:underline"
            >
              Select top {Math.min(remainingSlots, ranked.length)}
            </button>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {ranked.length === 0 && (
            <div className="text-center py-12 text-sm text-muted-foreground">
              No candidates match the current filters.
              {hideZero && <div className="text-xs mt-1">Try toggling "Hide zero-score" off.</div>}
            </div>
          )}
          <ul className="space-y-1.5">
            {ranked.map(m => {
              const checked = selected.has(m.intern.id);
              const statusCfg = STATUS_CONFIG[m.intern.status];
              return (
                <li
                  key={m.intern.id}
                  className={cn(
                    'rounded-md border bg-card p-2.5 flex items-start gap-2.5 transition-colors',
                    checked ? 'border-primary bg-primary/5' : 'hover:bg-muted/40',
                    m.alreadyAssignedElsewhere && 'opacity-70',
                  )}
                >
                  <button
                    onClick={() => toggleSelect(m.intern.id)}
                    className="mt-0.5 text-muted-foreground hover:text-primary"
                    aria-label={checked ? 'Deselect' : 'Select'}
                  >
                    {checked ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-foreground">
                        {m.intern.firstName} {m.intern.lastName}
                      </span>
                      <ScoreBadge score={m.score} />
                      {m.intern.grade && (
                        <Badge variant="outline" className="text-[10px] gap-0.5">
                          <GraduationCap className="h-2.5 w-2.5" />Gr {m.intern.grade}
                        </Badge>
                      )}
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border', statusCfg.bgClass, statusCfg.textClass, statusCfg.borderClass)}>
                        {statusCfg.label}
                      </span>
                      {m.intern.isEll && <span className="text-[10px] text-emerald-600">ELL</span>}
                      {m.intern.isCmsd && <span className="text-[10px] text-primary">CMSD</span>}
                      {m.alreadyAssignedElsewhere && (
                        <span className="text-[10px] text-amber-600 inline-flex items-center gap-0.5">
                          <AlertTriangle className="h-2.5 w-2.5" /> assigned elsewhere
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
                      {m.intern.school && (
                        <span className="inline-flex items-center gap-1"><SchoolIcon className="h-2.5 w-2.5" />{m.intern.school}</span>
                      )}
                      {m.intern.studentEmail && (
                        <span className="inline-flex items-center gap-1 truncate"><Mail className="h-2.5 w-2.5" />{m.intern.studentEmail}</span>
                      )}
                      {m.intern.phone && (
                        <span className="inline-flex items-center gap-1"><Phone className="h-2.5 w-2.5" />{m.intern.phone}</span>
                      )}
                    </div>
                    {m.reasons.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {m.reasons.slice(0, 4).map((r, i) => (
                          <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {r}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs px-2"
                    disabled={busy}
                    onClick={() => assignOne(m.intern)}
                  >
                    Assign
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'h-6 px-2 rounded-full text-[10px] font-medium border transition-colors',
        active
          ? 'bg-primary/10 border-primary/30 text-primary'
          : 'bg-card text-muted-foreground hover:text-foreground border-input',
      )}
    >
      {children}
    </button>
  );
}
