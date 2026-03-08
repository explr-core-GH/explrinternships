import { useState, useMemo } from 'react';
import { Search, Filter, Copy } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import InternCard from '@/components/InternCard';
import FileUpload from '@/components/FileUpload';
import { Input } from '@/components/ui/input';

export default function RosterPage() {
  const { interns, worksites } = useAppStore();
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [showDupesOnly, setShowDupesOnly] = useState(false);

  // Only show newest entries
  const activeInterns = useMemo(() => {
    return interns.filter(i => i.isNewest);
  }, [interns]);

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
    if (gradeFilter !== 'all') {
      list = list.filter(i => i.grade === gradeFilter);
    }
    if (showDupesOnly) {
      list = list.filter(i => i.isDuplicate);
    }
    return list.sort((a, b) => a.lastName.localeCompare(b.lastName));
  }, [activeInterns, search, gradeFilter, showDupesOnly]);

  const grades = useMemo(() => {
    const set = new Set(activeInterns.map(i => i.grade));
    return Array.from(set).sort();
  }, [activeInterns]);

  const dupeCount = activeInterns.filter(i => i.isDuplicate).length;

  if (interns.length === 0) {
    return (
      <div className="max-w-lg mx-auto mt-12">
        <h2 className="text-xl font-bold text-foreground mb-2">Intern Roster</h2>
        <p className="text-sm text-muted-foreground mb-6">Upload an Excel file to get started.</p>
        <FileUpload mode="replace" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl font-bold text-foreground">Intern Roster</h2>
          <p className="text-xs text-muted-foreground">
            {filtered.length} of {activeInterns.length} interns
            {dupeCount > 0 && ` · ${dupeCount} with duplicate entries`}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by name, school, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <select
          value={gradeFilter}
          onChange={(e) => setGradeFilter(e.target.value)}
          className="h-9 rounded-md border bg-card px-3 text-sm text-foreground"
        >
          <option value="all">All Grades</option>
          {grades.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
        {dupeCount > 0 && (
          <button
            onClick={() => setShowDupesOnly(!showDupesOnly)}
            className={`h-9 px-3 rounded-md border text-xs font-medium flex items-center gap-1.5 transition-colors ${
              showDupesOnly ? 'bg-warning/10 border-warning/30 text-warning' : 'bg-card text-muted-foreground hover:text-foreground'
            }`}
          >
            <Copy className="h-3.5 w-3.5" />
            Duplicates ({dupeCount})
          </button>
        )}
      </div>

      {/* Cards */}
      <div className="space-y-2">
        {filtered.map((intern) => (
          <InternCard key={intern.id} intern={intern} worksites={worksites} />
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-12">No interns match your filters.</p>
        )}
      </div>
    </div>
  );
}
