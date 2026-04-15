import { useState, useMemo } from 'react';
import { isEligibleForPreApprenticeship } from '@/lib/preApprenticeship';
import { Search, Copy, Download, CheckSquare, Square, Mail, List, School } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useAutoLoadData } from '@/hooks/useAutoLoadData';
import InternCard from '@/components/InternCard';
import SchoolGroupedRoster from '@/components/SchoolGroupedRoster';
import GoogleSheetSync from '@/components/GoogleSheetSync';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { exportRosterCSV, exportStatusContactCSV, exportEmailReadyByStatus, exportFullExcelByStatus } from '@/lib/exportData';
import { toast } from 'sonner';
import { INTERN_STATUSES, STATUS_CONFIG, type InternStatus } from '@/types/intern';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function RosterPage() {
  const { interns, worksites, assignments, loading, updateIntern, schoolContacts } = useAppStore();
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<InternStatus | 'all'>('all');
  const [showDupesOnly, setShowDupesOnly] = useState(false);
  const [assignFilter, setAssignFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'school'>('list');
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
        i.studentEmail.toLowerCase().includes(q) ||
        i.itInterests.some(interest => interest.toLowerCase().includes(q)) ||
        (q === 'ell' && i.isEll) ||
        (q === 'preapp' && isEligibleForPreApprenticeship(i.dob)) ||
        (q === 'pre-apprenticeship' && isEligibleForPreApprenticeship(i.dob))
      );
    }
    if (gradeFilter !== 'all') list = list.filter(i => i.grade === gradeFilter);
    if (statusFilter !== 'all') list = list.filter(i => i.status === statusFilter);
    if (showDupesOnly) list = list.filter(i => i.isDuplicate);
    if (assignFilter === 'assigned') list = list.filter(i => assignedIds.has(i.id));
    if (assignFilter === 'unassigned') list = list.filter(i => !assignedIds.has(i.id));

    // Sort: status priority, then last name
    const statusOrder: Record<InternStatus, number> = {
      removed: 9, selected_different_partner: 8, intake_issue: 7, intake_complete: 6, in_progress_you: 5, not_matched: 4, pending: 3, ready_to_place: 2, matched: 1, assigned: 0,
    };
    return list.sort((a, b) => {
      const sa = statusOrder[a.status] ?? 2;
      const sb = statusOrder[b.status] ?? 2;
      if (sa !== sb) return sa - sb;
      return a.lastName.localeCompare(b.lastName);
    });
  }, [activeInterns, search, gradeFilter, statusFilter, showDupesOnly, assignFilter, assignedIds]);

  const grades = useMemo(() => {
    const set = new Set(activeInterns.map(i => i.grade));
    return Array.from(set).sort();
  }, [activeInterns]);

  const dupeCount = activeInterns.filter(i => i.isDuplicate).length;
  const assignedCount = activeInterns.filter(i => assignedIds.has(i.id)).length;

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(i => i.id)));
    }
  };

  const bulkSetStatus = async (status: InternStatus) => {
    const promises = Array.from(selectedIds).map(id => updateIntern(id, { status }));
    await Promise.all(promises);
    toast.success(`Updated ${selectedIds.size} interns to ${STATUS_CONFIG[status].label}`);
    setSelectedIds(new Set());
    setBulkMode(false);
  };

  // Status counts for the filter badges
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    activeInterns.forEach(i => { counts[i.status] = (counts[i.status] || 0) + 1; });
    return counts;
  }, [activeInterns]);

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
          <div className="flex rounded-md border border-input overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={`h-8 px-2.5 flex items-center gap-1 text-xs font-medium transition-colors ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:text-foreground'}`}
            >
              <List className="h-3.5 w-3.5" /> List
            </button>
            <button
              onClick={() => setViewMode('school')}
              className={`h-8 px-2.5 flex items-center gap-1 text-xs font-medium transition-colors ${viewMode === 'school' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:text-foreground'}`}
            >
              <School className="h-3.5 w-3.5" /> By School
            </button>
          </div>
          <Button
            variant={bulkMode ? 'default' : 'outline'}
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => { setBulkMode(!bulkMode); setSelectedIds(new Set()); }}
          >
            <CheckSquare className="h-3.5 w-3.5" /> {bulkMode ? 'Exit Bulk' : 'Bulk Edit'}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => { exportRosterCSV(filtered, worksites, assignments); toast.success('Roster CSV downloaded'); }}>
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => { exportFullExcelByStatus(interns, worksites, assignments, schoolContacts); toast.success('Full Excel downloaded with sheets per status'); }}>
            <Download className="h-3.5 w-3.5" /> Export Excel
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <Mail className="h-3.5 w-3.5" /> Export by Status
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Email-Ready (Copy-Paste .txt)</div>
              {INTERN_STATUSES.map(s => (
                <DropdownMenuItem
                  key={`email-${s}`}
                  onClick={() => {
                    const ok = exportEmailReadyByStatus(interns, schoolContacts, s);
                    if (ok) toast.success(`Email-ready export for ${STATUS_CONFIG[s].label}`);
                    else toast.error(`No interns with status "${STATUS_CONFIG[s].label}"`);
                  }}
                >
                  <Mail className="h-3 w-3 mr-2 text-muted-foreground" />
                  <span className={`inline-block w-2 h-2 rounded-full mr-2 ${STATUS_CONFIG[s].bgClass}`} />
                  {STATUS_CONFIG[s].label} ({statusCounts[s] || 0})
                </DropdownMenuItem>
              ))}
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-1">Spreadsheet (.csv)</div>
              {INTERN_STATUSES.map(s => (
                <DropdownMenuItem
                  key={`csv-${s}`}
                  onClick={() => {
                    const ok = exportStatusContactCSV(interns, schoolContacts, s);
                    if (ok) toast.success(`Exported ${STATUS_CONFIG[s].label} interns with contacts`);
                    else toast.error(`No interns with status "${STATUS_CONFIG[s].label}"`);
                  }}
                >
                  <Download className="h-3 w-3 mr-2 text-muted-foreground" />
                  <span className={`inline-block w-2 h-2 rounded-full mr-2 ${STATUS_CONFIG[s].bgClass}`} />
                  {STATUS_CONFIG[s].label} ({statusCounts[s] || 0})
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Bulk action bar */}
      {bulkMode && selectedIds.size > 0 && (
        <div className="mb-4 p-3 rounded-lg border bg-card shadow-card flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">{selectedIds.size} selected —</span>
          <span className="text-xs text-muted-foreground mr-1">Set status:</span>
          {INTERN_STATUSES.filter(s => s !== 'pending').map(status => (
            <button
              key={status}
              onClick={() => bulkSetStatus(status)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium border ${STATUS_CONFIG[status].bgClass} ${STATUS_CONFIG[status].textClass} ${STATUS_CONFIG[status].borderClass} hover:opacity-80 transition-opacity`}
            >
              {STATUS_CONFIG[status].label}
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search by name, school, email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
        <select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground">
          <option value="all">All Grades</option>
          {grades.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground">
          <option value="all">All Statuses</option>
          {INTERN_STATUSES.map(s => (
            <option key={s} value={s}>{STATUS_CONFIG[s].label} ({statusCounts[s] || 0})</option>
          ))}
        </select>
        <select value={assignFilter} onChange={(e) => setAssignFilter(e.target.value as any)} className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground">
          <option value="all">All</option>
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

      {/* Select all in bulk mode */}
      {bulkMode && filtered.length > 0 && (
        <button onClick={selectAll} className="mb-2 flex items-center gap-1.5 text-xs text-primary hover:underline">
          {selectedIds.size === filtered.length ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
          {selectedIds.size === filtered.length ? 'Deselect all' : 'Select all'}
        </button>
      )}

      {viewMode === 'school' ? (
        loading ? (
          <p className="text-center text-sm text-muted-foreground py-12">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-12">No interns match your filters.</p>
        ) : (
          <SchoolGroupedRoster interns={filtered} worksites={worksites} />
        )
      ) : (
        <div className="space-y-2">
          {loading ? (
            <p className="text-center text-sm text-muted-foreground py-12">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">No interns match your filters.</p>
          ) : filtered.map((intern) => (
            <InternCard
              key={intern.id}
              intern={intern}
              worksites={worksites}
              bulkMode={bulkMode}
              selected={selectedIds.has(intern.id)}
              onToggleSelect={() => toggleSelect(intern.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
