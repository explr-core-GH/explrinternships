import { useState } from 'react';
import { Plus, Trash2, Building2, Users, MapPin, Download } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { WORKSITE_CATEGORIES, type Worksite } from '@/types/intern';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { exportWorksiteCSV } from '@/lib/exportData';

function AddWorksiteDialog({ onAdd }: { onAdd: (ws: Omit<Worksite, 'id'>) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: '', category: WORKSITE_CATEGORIES[0], description: '',
    capacity: 6, contactName: '', contactEmail: '', location: '', tags: '',
  });

  const handleSubmit = () => {
    if (!form.name.trim()) { toast.error('Name required'); return; }
    onAdd({
      name: form.name.trim(), category: form.category, description: form.description.trim(),
      capacity: form.capacity, filled: 0, contactName: form.contactName.trim(),
      contactEmail: form.contactEmail.trim(), location: form.location.trim(),
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
    });
    setOpen(false);
    setForm({ name: '', category: WORKSITE_CATEGORIES[0], description: '', capacity: 6, contactName: '', contactEmail: '', location: '', tags: '' });
    toast.success('Worksite added');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Add Worksite</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add Worksite</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Worksite name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full h-9 rounded-md border bg-card px-3 text-sm">
            {WORKSITE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <Input placeholder="Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
          <Input placeholder="Location" value={form.location} onChange={e => setForm({...form, location: e.target.value})} />
          <Input type="number" placeholder="Capacity" value={form.capacity} onChange={e => setForm({...form, capacity: +e.target.value})} />
          <Input placeholder="Contact name" value={form.contactName} onChange={e => setForm({...form, contactName: e.target.value})} />
          <Input placeholder="Contact email" value={form.contactEmail} onChange={e => setForm({...form, contactEmail: e.target.value})} />
          <Input placeholder="Tags (comma separated)" value={form.tags} onChange={e => setForm({...form, tags: e.target.value})} />
          <Button onClick={handleSubmit} className="w-full">Add Worksite</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function WorksitesPage() {
  const { worksites, interns, assignments, addWorksite, removeWorksite } = useAppStore();

  const totalCapacity = worksites.reduce((sum, w) => sum + w.capacity, 0);
  const totalFilled = worksites.reduce((sum, w) => sum + w.filled, 0);

  // Build assigned intern names per worksite
  const internMap = Object.fromEntries(interns.map(i => [i.id, i]));
  const wsInterns: Record<string, string[]> = {};
  assignments.forEach(a => {
    const intern = internMap[a.internId];
    if (intern) {
      if (!wsInterns[a.worksiteId]) wsInterns[a.worksiteId] = [];
      wsInterns[a.worksiteId].push(`${intern.firstName} ${intern.lastName}`);
    }
  });

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {worksites.map((ws) => {
          const pct = ws.capacity > 0 ? (ws.filled / ws.capacity) * 100 : 0;
          const isFull = ws.filled >= ws.capacity;
          const assigned = wsInterns[ws.id] || [];

          return (
            <div key={ws.id} className="rounded-lg border bg-card p-4 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-md bg-accent flex items-center justify-center">
                    <Building2 className="h-4 w-4 text-accent-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-card-foreground">{ws.name}</h3>
                    <Badge variant="outline" className="text-[10px] mt-0.5">{ws.category}</Badge>
                  </div>
                </div>
                <button onClick={() => { removeWorksite(ws.id); toast.success('Removed'); }} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {ws.description && <p className="text-xs text-muted-foreground mt-2">{ws.description}</p>}

              {/* Capacity bar */}
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

              {/* Assigned interns list */}
              {assigned.length > 0 && (
                <div className="mt-2">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">Assigned</p>
                  <div className="flex flex-wrap gap-1">
                    {assigned.map(name => (
                      <span key={name} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{name}</span>
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
