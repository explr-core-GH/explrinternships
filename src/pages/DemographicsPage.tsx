import { useCallback, useMemo, useRef, useState } from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { toPng } from 'html-to-image';
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

function downloadPng(node: HTMLElement, filename: string) {
  toPng(node, { backgroundColor: '#ffffff', pixelRatio: 2 })
    .then((dataUrl) => {
      const link = document.createElement('a');
      link.download = `${filename}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('PNG downloaded');
    })
    .catch(() => toast.error('Failed to generate PNG'));
}

const interestFields: InterestField[] = [
  'clevelandClinic', 'constructionMgmt', 'biomedical', 'envJustice',
  'envClimate', 'envFieldScience', 'iersCenter', 'magnetManufacturing',
  'educationInternship', 'healthcare', 'videoGames',
];

const GRADE_ORDER = ['8th', '9th', '10th', '11th', '12th'];

export default function DemographicsPage() {
  useAutoLoadData();
  const { interns } = useAppStore();
  const gradeRef = useRef<HTMLDivElement>(null);
  const schoolRef = useRef<HTMLDivElement>(null);
  const genderRef = useRef<HTMLDivElement>(null);
  const raceRef = useRef<HTMLDivElement>(null);
  const ellRef = useRef<HTMLDivElement>(null);
  const interestRef = useRef<HTMLDivElement>(null);
  const itRef = useRef<HTMLDivElement>(null);
  const programRef = useRef<HTMLDivElement>(null);

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
      if (intern.gender) {
        genders[intern.gender] = (genders[intern.gender] || 0) + 1;
      }
      // Race/ethnicity — may contain multiple separated by semicolons
      if (intern.raceEthnicity) {
        const raceParts = intern.raceEthnicity.includes(';') ? intern.raceEthnicity.split(';').map(r => r.trim()).filter(Boolean) : [intern.raceEthnicity];
        for (const rp of raceParts) {
          races[rp] = (races[rp] || 0) + 1;
        }
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

    const ellCount = active.filter(i => i.isEll).length;
    const nonEllCount = active.length - ellCount;

    return { grades, schools, programs, genders, races, interestCounts, ellCount, nonEllCount };
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
            <div ref={gradeRef} className="rounded-lg border bg-card p-4 shadow-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-card-foreground">By Grade</h3>
                <button onClick={() => gradeRef.current && downloadPng(gradeRef.current, 'grade-breakdown')} className="text-muted-foreground hover:text-foreground"><Download className="h-3.5 w-3.5" /></button>
              </div>
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

            <div ref={schoolRef} className="rounded-lg border bg-card p-4 shadow-card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-card-foreground">By School</h3>
                <button onClick={() => schoolRef.current && downloadPng(schoolRef.current, 'school-breakdown')} className="text-muted-foreground hover:text-foreground"><Download className="h-3.5 w-3.5" /></button>
              </div>
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

          {/* Pie charts row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Gender Pie */}
            {Object.keys(stats.genders).length > 0 && (
              <div className="rounded-lg border bg-card p-4 shadow-card">
                <h3 className="text-sm font-semibold text-card-foreground mb-3">By Gender</h3>
                <PieChart data={Object.entries(stats.genders).sort((a, b) => b[1] - a[1])} />
                <p className="text-[10px] text-muted-foreground mt-2 italic">Students without intake data on file are not included in gender demographics.</p>
              </div>
            )}

            {/* Race/Ethnicity Pie */}
            {Object.keys(stats.races).length > 0 && (
              <div className="rounded-lg border bg-card p-4 shadow-card">
                <h3 className="text-sm font-semibold text-card-foreground mb-3">By Race / Ethnicity</h3>
                <PieChart data={Object.entries(stats.races).sort((a, b) => b[1] - a[1])} />
                <p className="text-[10px] text-muted-foreground mt-2 italic">Students without intake data on file are not included in race/ethnicity demographics.</p>
              </div>
            )}

            {/* ELL Pie */}
            {stats.ellCount > 0 && (
              <div className="rounded-lg border bg-card p-4 shadow-card">
                <h3 className="text-sm font-semibold text-card-foreground mb-3">English Language Learners (ELL)</h3>
                <PieChart data={[['ELL', stats.ellCount], ['Non-ELL', stats.nonEllCount]]} />
              </div>
            )}
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

const PIE_COLORS = [
  'hsl(168, 72%, 31%)', 'hsl(200, 70%, 50%)', 'hsl(340, 65%, 55%)', 'hsl(45, 85%, 50%)',
  'hsl(270, 55%, 55%)', 'hsl(120, 45%, 45%)', 'hsl(15, 75%, 55%)', 'hsl(195, 60%, 40%)',
  'hsl(300, 40%, 50%)', 'hsl(60, 60%, 45%)', 'hsl(220, 60%, 55%)', 'hsl(0, 55%, 50%)',
];

function PieChart({ data }: { data: [string, number][] }) {
  const total = data.reduce((s, [, v]) => s + v, 0);
  if (total === 0) return null;

  const slices: { label: string; count: number; pct: number; startAngle: number; endAngle: number; color: string }[] = [];
  let cumAngle = -90; // start from top
  data.forEach(([label, count], i) => {
    const pct = (count / total) * 100;
    const angle = (count / total) * 360;
    slices.push({ label, count, pct, startAngle: cumAngle, endAngle: cumAngle + angle, color: PIE_COLORS[i % PIE_COLORS.length] });
    cumAngle += angle;
  });

  const r = 80;
  const cx = 100;
  const cy = 100;

  function arcPath(startAngle: number, endAngle: number) {
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <svg viewBox="0 0 200 200" className="w-40 h-40">
        {slices.map((s, i) =>
          s.pct >= 100 ? (
            <circle key={i} cx={cx} cy={cy} r={r} fill={s.color} />
          ) : (
            <path key={i} d={arcPath(s.startAngle, s.endAngle)} fill={s.color} stroke="hsl(var(--card))" strokeWidth="1" />
          )
        )}
      </svg>
      <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            <span className="truncate max-w-24">{s.label}</span>
            <span className="font-semibold text-foreground">{s.count}</span>
            <span>({Math.round(s.pct)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}
