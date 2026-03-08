import { useState, useMemo } from 'react';
import { Search, Copy, Download } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useAutoLoadData } from '@/hooks/useAutoLoadData';
import InternCard from '@/components/InternCard';
import GoogleSheetSync from '@/components/GoogleSheetSync';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { exportRosterCSV, exportWorksiteCSV } from '@/lib/exportData';
import { toast } from 'sonner';

export default function RosterPage() {
  const { interns, worksites, assignments, loading } = useAppStore();
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [showDupesOnly, setShowDupesOnly] = useState(false);
  const [assignFilter, setAssignFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');
  useAutoLoadData();

  const activeInterns = useMemo(() => interns.filter(i => i.isNewest), [interns]);
  const assignedIds = useMemo(() => new Set(assignments.map(a => a.internId)), [assignments]);

  const filtered = useMemo(() => {
    let list = activeInterns;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(i =>
        `${i.firstName} ${i.lastName}`.toLowerCase().includes(q) ||
        i.school.toLowerCase().includes(q) ||
        i.studentEmail.toLowerCase().includes(q)
      );
    }
    if (gradeFilter !== 'all') list = list.filter(i => i.grade === gradeFilter);
    if (showDupesOnly) list = list.filter(i => i.isDuplicate);
    if (assignFilter === 'assigned') list = list.filter(i => assignedIds.has(i.id));
    if (assignFilter === 'unassigned') list = list.filter(i => !assignedIds.has(i.id));
    return list.sort((a, b) => a.lastName.localeCompare(b.lastName));
  }, [activeInterns, search, gradeFilter, showDupesOnly, assignFilter, assignedIds]);

  const grades = useMemo(() => {
    const set = new Set(activeInterns.map(i => i.grade));
    return Array.from(set).sort();
  }, [activeInterns]);

  const dupeCount = activeInterns.filter(i => i.isDuplicate).length;
  const assignedCount = activeInterns.filter(i => assignedIds.has(i.id)).length;

  if (!loading && interns.length === 0) {
    return (
      <div className="max-w-lg mx-auto mt-12 space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground mb-2">Intern Roster</h2>
          <p className="text-sm text-muted-foreground mb-6">Sync from Google Sheets or upload an Excel file to get started.</p>
        </div>
        <GoogleSheetSync />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl font-bold text-foreground">Intern Roster</h2>
          <p className="text-xs text-muted-foreground">
            {filtered.length} of {activeInterns.length} interns · {assignedCount} assigned
            {dupeCount > 0 && ` · ${dupeCount} with duplicate entries`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => { exportRosterCSV(filtered, worksites, assignments); toast.success('Roster CSV downloaded'); }}>
            <Download className="h-3.5 w-3.5" /> Export Roster
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => { exportWorksiteCSV(worksites, assignments, interns); toast.success('Worksite report downloaded'); }}>
            <Download className="h-3.5 w-3.5" /> Export Worksites
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search by name, school, email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
        <select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} className="h-9 rounded-md border bg-card px-3 text-sm text-foreground">
          <option value="all">All Grades</option>
          {grades.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={assignFilter} onChange={(e) => setAssignFilter(e.target.value as any)} className="h-9 rounded-md border bg-card px-3 text-sm text-foreground">
          <option value="all">All Status</option>
          <option value="assigned">Assigned</option>
          <option value="unassigned">Unassigned</option>
        </select>
        {dupeCount > 0 && (
          <button
            onClick={() => setShowDupesOnly(!showDupesOnly)}
            className={`h-9 px-3 rounded-md border text-xs font-medium flex items-center gap-1.5 transition-colors ${showDupesOnly ? 'bg-warning/10 border-warning/30 text-warning' : 'bg-card text-muted-foreground hover:text-foreground'}`}
          >
            <Copy className="h-3.5 w-3.5" />
            Duplicates ({dupeCount})
          </button>
        )}
      </div>

      <div className="space-y-2">
        {loading ? (
          <p className="text-center text-sm text-muted-foreground py-12">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-12">No interns match your filters.</p>
        ) : filtered.map((intern) => (
          <InternCard key={intern.id} intern={intern} worksites={worksites} />
        ))}
      </div>
    </div>
  );
}
