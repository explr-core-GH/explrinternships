import { useState } from 'react';
import { Plus, Trash2, Building2, Users, MapPin, Download, Pencil, Tag, X, Sparkles, Target } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import {
  WORKSITE_CATEGORIES,
  WORKSITE_STATUSES,
  WORKSITE_STATUS_CONFIG,
  WORKSITE_LABEL_COLORS,
  WORKSITE_LABEL_COLOR_CLASSES,
  WORKSITE_INTEREST_FIELD_OPTIONS,
  DIRECT_INTEREST_FIELD_LABELS,
  type Worksite,
  type WorksiteStatus,
  type WorksiteLabel,
  type WorksiteLabelColor,
  type DirectInterestFieldKey,
} from '@/types/intern';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { exportWorksiteCSV } from '@/lib/exportData';
import { cn } from '@/lib/utils';
import WorksiteMatchPanel from '@/components/WorksiteMatchPanel';
import { useAutoLoadData } from '@/hooks/useAutoLoadData';

type FormShape = {
  name: string; category: string; description: string; capacity: number;
  contactName: string; contactEmail: string; location: string; tags: string;
  status: WorksiteStatus; labels: WorksiteLabel[];
  interestFieldKeys: DirectInterestFieldKey[];
};

function LabelEditor({ labels, onChange }: { labels: WorksiteLabel[]; onChange: (l: WorksiteLabel[]) => void }) {
  const [text, setText] = useState('');
  const [color, setColor] = useState<WorksiteLabelColor>('blue');
  const add = () => {
    const t = text.trim();
    if (!t) return;
    onChange([...labels, { text: t, color }]);
    setText('');
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {labels.map((l, i) => (
          <span key={i} className={cn('inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border', WORKSITE_LABEL_COLOR_CLASSES[l.color])}>
            {l.text}
            <button type="button" onClick={() => onChange(labels.filter((_, j) => j !== i))} className="hover:opacity-70">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input placeholder="New label" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} className="flex-1" />
        <select value={color} onChange={e => setColor(e.target.value as WorksiteLabelColor)} className="h-10 rounded-md border border-input bg-background px-2 text-sm">
          {WORKSITE_LABEL_COLORS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <Button type="button" size="sm" onClick={add}>Add</Button>
      </div>
      <div className="flex flex-wrap gap-1">
        {WORKSITE_LABEL_COLORS.map(c => (
          <button type="button" key={c} onClick={() => setColor(c)} className={cn('px-2 py-0.5 rounded-full text-[10px] border', WORKSITE_LABEL_COLOR_CLASSES[c], color === c && 'ring-2 ring-ring')}>
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Multi-select picker for the Yes/Maybe/No interest fields on the
 * intern record that should score this worksite. Toggling a chip adds
 * or removes the key from worksite.interestFieldKeys. Drives the
 * Match Students panel — admins can repoint a worksite (e.g. IERS ->
 * NASA) by editing this without touching code.
 */
function InterestFieldPicker({
  selected, onChange,
}: { selected: DirectInterestFieldKey[]; onChange: (next: DirectInterestFieldKey[]) => void }) {
  const toggle = (key: DirectInterestFieldKey) => {
    if (selected.includes(key)) onChange(selected.filter(k => k !== key));
    else onChange([...selected, key]);
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {WORKSITE_INTEREST_FIELD_OPTIONS.map(opt => {
        const active = selected.includes(opt.key);
        return (
          <button
            type="button"
            key={opt.key}
            onClick={() => toggle(opt.key)}
            className={cn(
              'h-7 px-2.5 rounded-full text-[11px] font-medium border transition-colors',
              active
                ? 'bg-primary/10 border-primary/40 text-primary'
                : 'bg-card text-muted-foreground border-input hover:text-foreground',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function WorksiteForm({ initial, onSubmit, submitLabel }: {
  initial: FormShape;
  onSubmit: (form: FormShape) => void;
  submitLabel: string;
}) {
  const [form, setForm] = useState<FormShape>(initial);

  const handleSubmit = () => {
    if (!form.name.trim()) { toast.error('Name required'); return; }
    onSubmit(form);
  };

  return (
    <div className="space-y-3">
      <Input placeholder="Worksite name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
      <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
        {WORKSITE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Status</label>
        <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as WorksiteStatus })} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
          {WORKSITE_STATUSES.map(s => <option key={s} value={s}>{WORKSITE_STATUS_CONFIG[s].label}</option>)}
        </select>
      </div>
      <Input placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
      <Input placeholder="Location" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
      <Input type="number" placeholder="Capacity" value={form.capacity} onChange={e => setForm({ ...form, capacity: +e.target.value })} />
      <Input placeholder="Contact name" value={form.contactName} onChange={e => setForm({ ...form, contactName: e.target.value })} />
      <Input placeholder="Contact email" value={form.contactEmail} onChange={e => setForm({ ...form, contactEmail: e.target.value })} />
      <Input placeholder="Tags (comma separated)" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} />

      <div>
        <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
          <Target className="h-3 w-3" /> Interest Fields (matched from interest form)
        </label>
        <p className="text-[10px] text-muted-foreground mb-1.5">
          Pick the form questions whose &quot;Yes&quot; or &quot;Maybe&quot; should rank a student high for this worksite.
        </p>
        <InterestFieldPicker
          selected={form.interestFieldKeys}
          onChange={(next) => setForm({ ...form, interestFieldKeys: next })}
        />
      </div>

      <div>
        <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1"><Tag className="h-3 w-3" /> Colored Labels</label>
        <LabelEditor labels={form.labels} onChange={(l) => setForm({ ...form, labels: l })} />
      </div>
      <Button onClick={handleSubmit} className="w-full">{submitLabel}</Button>
    </div>
  );
}

function AddWorksiteDialog({ onAdd }: { onAdd: (ws: Omit<Worksite, 'id'>) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Add Worksite</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add Worksite</DialogTitle></DialogHeader>
        <WorksiteForm
          initial={{ name: '', category: WORKSITE_CATEGORIES[0], description: '', capacity: 6, contactName: '', contactEmail: '', location: '', tags: '', status: 'open', labels: [], interestFieldKeys: [] }}
          submitLabel="Add Worksite"
          onSubmit={(form) => {
            onAdd({
              name: form.name.trim(), category: form.category, description: form.description.trim(),
              capacity: form.capacity, filled: 0, contactName: form.contactName.trim(),
              contactEmail: form.contactEmail.trim(), location: form.location.trim(),
              tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
              status: form.status, labels: form.labels,
              interestFieldKeys: form.interestFieldKeys,
            });
            setOpen(false);
            toast.success('Worksite added');
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function EditWorksiteDialog({ ws, onSave }: { ws: Worksite; onSave: (id: string, updates: Partial<Worksite>) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="text-muted-foreground hover:text-primary transition-colors p-1">
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit Worksite</DialogTitle></DialogHeader>
        <WorksiteForm
          initial={{
            name: ws.name, category: ws.category, description: ws.description,
            capacity: ws.capacity, contactName: ws.contactName, contactEmail: ws.contactEmail,
            location: ws.location, tags: ws.tags.join(', '),
            status: ws.status || 'open', labels: ws.labels || [],
            interestFieldKeys: ws.interestFieldKeys || [],
          }}
          submitLabel="Save Changes"
          onSubmit={(form) => {
            onSave(ws.id, {
              name: form.name.trim(), category: form.category, description: form.description.trim(),
              capacity: form.capacity, contactName: form.contactName.trim(),
              contactEmail: form.contactEmail.trim(), location: form.location.trim(),
              tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
              status: form.status, labels: form.labels,
              interestFieldKeys: form.interestFieldKeys,
            });
            setOpen(false);
            toast.success('Worksite updated');
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

export default function WorksitesPage() {
  useAutoLoadData();
  const { worksites, interns, assignments, addWorksite, removeWorksite, updateWorksite, unassignIntern, assignIntern, updateIntern, loading } = useAppStore();
  const [matchTarget, setMatchTarget] = useState<Worksite | null>(null);
  const [rosterTarget, setRosterTarget] = useState<Worksite | null>(null);

  const totalCapacity = worksites.reduce((sum, w) => sum + w.capacity, 0);
  const totalFilled = worksites.reduce((sum, w) => sum + w.filled, 0);
  const readyToPlaceCount = interns.filter(i => i.status === 'ready_to_place').length;
  const placedCount = interns.filter(i => i.status === 'assigned' || i.status === 'in_progress_you').length;

  const internMap = Object.fromEntries(interns.map(i => [i.id, i]));
  const wsInterns: Record<string, { id: string; name: string }[]> = {};
  assignments.forEach(a => {
    const intern = internMap[a.internId];
    if (intern) {
      if (!wsInterns[a.worksiteId]) wsInterns[a.worksiteId] = [];
      wsInterns[a.worksiteId].push({ id: intern.id, name: `${intern.firstName} ${intern.lastName}` });
    }
  });

  if (loading && worksites.length === 0) {
    return <p className="text-center text-sm text-muted-foreground py-12">Loading worksites…</p>;
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-foreground">Worksites</h2>
          <p className="text-xs text-muted-foreground">{worksites.length} worksites · {totalFilled}/{totalCapacity} spots filled</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => { exportWorksiteCSV(worksites, assignments, interns); toast.success('Downloaded'); }}>
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
          <AddWorksiteDialog onAdd={addWorksite} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="rounded-lg border bg-card p-4 shadow-card">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Placed</p>
          <p className="text-4xl font-bold text-primary mt-1">{placedCount}</p>
          <p className="text-[11px] text-muted-foreground mt-1">students assigned to a worksite</p>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-card">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Ready to Place</p>
          <p className="text-4xl font-bold text-amber-600 mt-1">{readyToPlaceCount}</p>
          <p className="text-[11px] text-muted-foreground mt-1">remaining to be placed</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {worksites.map((ws) => {
          const pct = ws.capacity > 0 ? (ws.filled / ws.capacity) * 100 : 0;
          const isFull = ws.filled >= ws.capacity;
          const assigned = wsInterns[ws.id] || [];
          const status = ws.status || 'open';
          const statusCfg = WORKSITE_STATUS_CONFIG[status];
          const labels = ws.labels || [];
          const interestKeys = ws.interestFieldKeys || [];

          return (
            <div key={ws.id} className="rounded-lg border bg-card p-4 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-md bg-accent flex items-center justify-center">
                    <Building2 className="h-4 w-4 text-accent-foreground" />
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => setRosterTarget(ws)}
                      className="font-semibold text-sm text-card-foreground hover:text-primary hover:underline text-left"
                    >
                      {ws.name}
                    </button>
                    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">{ws.category}</Badge>
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full border', statusCfg.className)}>{statusCfg.label}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-0.5">
                  <EditWorksiteDialog ws={ws} onSave={updateWorksite} />
                  <button onClick={() => { removeWorksite(ws.id); toast.success('Removed'); }} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {labels.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {labels.map((l, i) => (
                    <span key={i} className={cn('text-[10px] px-2 py-0.5 rounded-full border', WORKSITE_LABEL_COLOR_CLASSES[l.color])}>{l.text}</span>
                  ))}
                </div>
              )}
              {ws.description && <p className="text-xs text-muted-foreground mt-2">{ws.description}</p>}

              <div className="mt-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Users className="h-3 w-3" />
                    {ws.filled}/{ws.capacity} filled
                  </span>
                  {isFull && <Badge variant="destructive" className="text-[10px]">Full</Badge>}
                </div>
                <Progress value={pct} className="h-2" />
              </div>

              {assigned.length > 0 && (
                <div className="mt-2">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">Assigned</p>
                  <div className="flex flex-wrap gap-1">
                    {assigned.map(a => (
                      <Popover key={a.id}>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="text-[10px] bg-primary/10 text-primary hover:bg-primary/20 transition-colors px-1.5 py-0.5 rounded cursor-pointer"
                          >
                            {a.name}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-60 p-2" align="start">
                          <p className="text-xs font-semibold mb-2 px-1">{a.name}</p>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="w-full justify-start h-8 text-xs"
                            onClick={async () => {
                              await unassignIntern(a.id);
                              await updateIntern(a.id, { status: 'ready_to_place' });
                              toast.success(`Unassigned ${a.name}`);
                            }}
                          >
                            <X className="h-3 w-3" /> Unassign
                          </Button>
                          <div className="border-t my-1" />
                          <p className="text-[10px] text-muted-foreground px-1 mb-1">Move to:</p>
                          <div className="max-h-48 overflow-y-auto">
                            {worksites
                              .filter(w => w.id !== ws.id)
                              .map(w => {
                                const isFull = (w.filled || 0) >= w.capacity;
                                return (
                                  <Button
                                    key={w.id}
                                    size="sm"
                                    variant="ghost"
                                    disabled={isFull}
                                    className="w-full justify-start h-8 text-xs"
                                    onClick={async () => {
                                      await assignIntern(a.id, w.id);
                                      await updateIntern(a.id, { status: 'assigned' });
                                      toast.success(`Moved ${a.name} to ${w.name}`);
                                    }}
                                  >
                                    <span className="truncate flex-1 text-left">{w.name}</span>
                                    <span className="text-[10px] text-muted-foreground ml-1">
                                      {w.filled}/{w.capacity}
                                    </span>
                                  </Button>
                                );
                              })}
                          </div>
                        </PopoverContent>
                      </Popover>
                    ))}
                  </div>
                </div>
              )}

              {ws.location && (
                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {ws.location}
                </div>
              )}
              {ws.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {ws.tags.map(t => <span key={t} className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{t}</span>)}
                </div>
              )}

              {/* Interest fields this worksite is matched on */}
              {interestKeys.length > 0 && (
                <div className="mt-2">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-1 flex items-center gap-1">
                    <Target className="h-2.5 w-2.5" />
                    Matched on
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {interestKeys.map(k => (
                      <span key={k} className="text-[10px] bg-primary/5 text-primary border border-primary/20 px-1.5 py-0.5 rounded">
                        {DIRECT_INTEREST_FIELD_LABELS[k] || k}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Match Students action */}
              <div className="mt-3 pt-3 border-t border-border">
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-full h-8 gap-1.5 text-xs"
                  onClick={() => setMatchTarget(ws)}
                  disabled={status === 'closed'}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Match Students {!isFull && `(${ws.capacity - ws.filled} open)`}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <WorksiteMatchPanel
        worksite={matchTarget}
        open={matchTarget !== null}
        onOpenChange={(o) => { if (!o) setMatchTarget(null); }}
      />

      <Dialog open={rosterTarget !== null} onOpenChange={(o) => { if (!o) setRosterTarget(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              {rosterTarget?.name} Roster
            </DialogTitle>
          </DialogHeader>
          {rosterTarget && (() => {
            const roster = assignments
              .filter(a => a.worksiteId === rosterTarget.id)
              .map(a => internMap[a.internId])
              .filter(Boolean);
            if (roster.length === 0) {
              return <p className="text-sm text-muted-foreground py-6 text-center">No students assigned yet.</p>;
            }
            return (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {roster.length} of {rosterTarget.capacity} spots filled
                </p>
                <div className="divide-y divide-border border rounded-md">
                  {roster.map((i, idx) => (
                    <div key={i.id} className="p-3 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {idx + 1}. {i.firstName} {i.lastName}
                        </p>
                        <div className="text-[11px] text-muted-foreground mt-0.5 space-y-0.5">
                          {i.school && <div>{i.school}{i.grade ? ` · Grade ${i.grade}` : ''}</div>}
                          {(i.studentEmail || i.emailSubmission) && (
                            <div className="truncate">{i.studentEmail || i.emailSubmission}</div>
                          )}
                          {i.phone && <div>{i.phone}</div>}
                        </div>
                      </div>
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap', WORKSITE_STATUS_CONFIG['open'].className)}>
                        {i.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
