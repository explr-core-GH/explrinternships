import { useMemo, useState } from 'react';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useAutoLoadData } from '@/hooks/useAutoLoadData';
import { INTEREST_LABELS, type InterestField, INTERN_STATUSES, STATUS_CONFIG, type InternStatus } from '@/types/intern';
import { exportDemographicsExcel, exportDemographicsPDF } from '@/lib/exportDemographics';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const interestFields: InterestField[] = [
  'clevelandClinic', 'constructionMgmt', 'biomedical', 'envJustice',
  'envClimate', 'envFieldScience', 'iersCenter', 'magnetManufacturing',
  'educationInternship', 'healthcare', 'videoGames',
];

const GRADE_ORDER = ['8th', '9th', '10th', '11th', '12th'];

export default function DemographicsPage() {
  useAutoLoadData();
  const { interns } = useAppStore();
  const [statusFilter, setStatusFilter] = useState<InternStatus | 'all'>('all');

  const active = useMemo(() => {
    const newest = interns.filter(i => i.isNewest);
    if (statusFilter === 'all') return newest;
    return newest.filter(i => i.status === statusFilter);
  }, [interns, statusFilter]);

  const stats = useMemo(() => {
    const grades: Record<string, number> = {};
    const schools: Record<string, number> = {};
    const programs: Record<string, number> = {};
    const genders: Record<string, number> = {};
    const races: Record<string, number> = {};
    const interestCounts: Record<string, { yes: number; maybe: number; no: number }> = {};

    for (const f of interestFields) {
      interestCounts[f] = { yes: 0, maybe: 0, no: 0 };
    }

    for (const intern of active) {
      grades[intern.grade] = (grades[intern.grade] || 0) + 1;
      const school = intern.otherSchool || intern.school;
      schools[school] = (schools[school] || 0) + 1;
      const g = intern.gender || 'Not specified';
      genders[g] = (genders[g] || 0) + 1;
      // Race/ethnicity — may contain multiple separated by semicolons
      const raceRaw = intern.raceEthnicity || 'Not specified';
      const raceParts = raceRaw.includes(';') ? raceRaw.split(';').map(r => r.trim()).filter(Boolean) : [raceRaw];
      for (const rp of raceParts) {
        races[rp] = (races[rp] || 0) + 1;
      }
      for (const p of intern.programs) {
        if (p !== 'Not Applicable/None') programs[p] = (programs[p] || 0) + 1;
      }
      for (const f of interestFields) {
        const v = intern[f];
        if (v === 'Yes') interestCounts[f].yes++;
        else if (v === 'Maybe') interestCounts[f].maybe++;
        else interestCounts[f].no++;
      }
    }

    return { grades, schools, programs, genders, races, interestCounts };
  }, [active]);

  const sortedGrades = useMemo(() => {
    return GRADE_ORDER
      .filter(g => stats.grades[g] !== undefined)
      .map(g => ({ grade: g, count: stats.grades[g] }));
  }, [stats.grades]);

  const itInterests = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const intern of active) {
      for (const it of intern.itInterests) {
        counts[it] = (counts[it] || 0) + 1;
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [active]);

  if (interns.filter(i => i.isNewest).length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Upload intern data to see demographics.</p>
      </div>
    );
  }

  const totalGradeStudents = sortedGrades.reduce((sum, g) => sum + g.count, 0);

  return (
    <div className="max-w-5xl mx-auto animate-fade-in space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Demographics & Data Overview</h2>
          <p className="text-xs text-muted-foreground">{active.length} interns{statusFilter !== 'all' ? ` · ${STATUS_CONFIG[statusFilter].label}` : ''}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as InternStatus | 'all')}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {INTERN_STATUSES.map(s => (
                <SelectItem key={s} value={s}>
                  <span className="flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_CONFIG[s].color }} />
                    {STATUS_CONFIG[s].label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              exportDemographicsExcel(interns, statusFilter);
              toast.success('Excel exported');
            }}
            disabled={active.length === 0}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              exportDemographicsPDF(interns, statusFilter);
              toast.success('PDF exported');
            }}
            disabled={active.length === 0}
          >
            <FileText className="h-3.5 w-3.5" />
            PDF
          </Button>
        </div>
      </div>

      {active.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No interns with status "{STATUS_CONFIG[statusFilter as InternStatus]?.label}".</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total Interns" value={active.length} />
            <StatCard label="Schools" value={Object.keys(stats.schools).length} />
            <StatCard label="Grades" value={Object.keys(stats.grades).length} />
            <StatCard label="Duplicates" value={active.filter(i => i.isDuplicate).length} />
          </div>

          {/* Grade breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border bg-card p-4 shadow-card">
              <h3 className="text-sm font-semibold text-card-foreground mb-4">By Grade</h3>
              <div className="grid grid-cols-5 gap-2">
                {sortedGrades.map(({ grade, count }) => {
                  const pct = Math.round((count / totalGradeStudents) * 100);
                  return (
                    <div key={grade} className="flex flex-col items-center">
                      <div className="relative h-16 w-16 mb-1.5">
                        <svg className="h-16 w-16 -rotate-90" viewBox="0 0 36 36">
                          <circle cx="18" cy="18" r="15.9" fill="none" className="stroke-muted" strokeWidth="3" />
                          <circle
                            cx="18" cy="18" r="15.9" fill="none"
                            className="stroke-primary"
                            strokeWidth="3"
                            strokeDasharray={`${pct} ${100 - pct}`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-sm font-bold text-foreground">{count}</span>
                        </div>
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">{grade}</span>
                      <span className="text-[10px] text-muted-foreground">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg border bg-card p-4 shadow-card">
              <h3 className="text-sm font-semibold text-card-foreground mb-3">By School</h3>
              <div className="space-y-1.5 max-h-64 overflow-auto">
                {Object.entries(stats.schools)
                  .sort((a, b) => b[1] - a[1])
                  .map(([school, count]) => (
                    <div key={school} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground truncate flex-1">{school}</span>
                      <span className="font-medium text-foreground ml-2">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Gender breakdown */}
          {Object.keys(stats.genders).length > 0 && (
            <div className="rounded-lg border bg-card p-4 shadow-card">
              <h3 className="text-sm font-semibold text-card-foreground mb-3">By Gender</h3>
              <div className="flex items-center gap-6 flex-wrap">
                {Object.entries(stats.genders)
                  .sort((a, b) => b[1] - a[1])
                  .map(([gender, count]) => {
                    const pct = Math.round((count / active.length) * 100);
                    return (
                      <div key={gender} className="flex flex-col items-center">
                        <div className="relative h-16 w-16 mb-1.5">
                          <svg className="h-16 w-16 -rotate-90" viewBox="0 0 36 36">
                            <circle cx="18" cy="18" r="15.9" fill="none" className="stroke-muted" strokeWidth="3" />
                            <circle
                              cx="18" cy="18" r="15.9" fill="none"
                              className="stroke-primary"
                              strokeWidth="3"
                              strokeDasharray={`${pct} ${100 - pct}`}
                              strokeLinecap="round"
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-sm font-bold text-foreground">{count}</span>
                          </div>
                        </div>
                        <span className="text-xs font-medium text-muted-foreground">{gender}</span>
                        <span className="text-[10px] text-muted-foreground">{pct}%</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Race/Ethnicity breakdown */}
          {Object.keys(stats.races).length > 0 && (
            <div className="rounded-lg border bg-card p-4 shadow-card">
              <h3 className="text-sm font-semibold text-card-foreground mb-3">By Race / Ethnicity</h3>
              <div className="flex items-center gap-6 flex-wrap">
                {Object.entries(stats.races)
                  .sort((a, b) => b[1] - a[1])
                  .map(([race, count]) => {
                    const pct = Math.round((count / active.length) * 100);
                    return (
                      <div key={race} className="flex flex-col items-center">
                        <div className="relative h-16 w-16 mb-1.5">
                          <svg className="h-16 w-16 -rotate-90" viewBox="0 0 36 36">
                            <circle cx="18" cy="18" r="15.9" fill="none" className="stroke-muted" strokeWidth="3" />
                            <circle
                              cx="18" cy="18" r="15.9" fill="none"
                              className="stroke-primary"
                              strokeWidth="3"
                              strokeDasharray={`${pct} ${100 - pct}`}
                              strokeLinecap="round"
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-sm font-bold text-foreground">{count}</span>
                          </div>
                        </div>
                        <span className="text-xs font-medium text-muted-foreground text-center max-w-20">{race}</span>
                        <span className="text-[10px] text-muted-foreground">{pct}%</span>
                      </div>
                    );
                  })}
              </div>
            </div>

          <div className="rounded-lg border bg-card p-4 shadow-card">
            <h3 className="text-sm font-semibold text-card-foreground mb-3">Internship Interest Levels</h3>
            <div className="space-y-2">
              {interestFields.map(f => {
                const { yes, maybe, no } = stats.interestCounts[f];
                const total = yes + maybe + no;
                return (
                  <div key={f} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-48 truncate">{INTEREST_LABELS[f]}</span>
                    <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden flex">
                      <div className="h-full bg-success transition-all" style={{ width: `${(yes / total) * 100}%` }} title={`Yes: ${yes}`} />
                      <div className="h-full bg-warning transition-all" style={{ width: `${(maybe / total) * 100}%` }} title={`Maybe: ${maybe}`} />
                    </div>
                    <div className="flex gap-2 text-[10px] w-28">
                      <span className="text-success">{yes}Y</span>
                      <span className="text-warning">{maybe}M</span>
                      <span className="text-muted-foreground">{no}N</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* IT interests */}
          <div className="rounded-lg border bg-card p-4 shadow-card">
            <h3 className="text-sm font-semibold text-card-foreground mb-3">Top IT Interests</h3>
            <div className="flex flex-wrap gap-2">
              {itInterests.slice(0, 20).map(([interest, count]) => (
                <div key={interest} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent text-accent-foreground text-xs">
                  <span>{interest}</span>
                  <span className="font-semibold text-primary">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Programs */}
          {Object.keys(stats.programs).length > 0 && (
            <div className="rounded-lg border bg-card p-4 shadow-card">
              <h3 className="text-sm font-semibold text-card-foreground mb-3">Prior Program Participation</h3>
              <div className="space-y-1.5">
                {Object.entries(stats.programs)
                  .sort((a, b) => b[1] - a[1])
                  .map(([program, count]) => (
                    <div key={program} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{program}</span>
                      <span className="font-medium text-foreground">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-3 shadow-card">
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
