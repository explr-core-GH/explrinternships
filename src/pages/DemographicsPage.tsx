import { useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { INTEREST_LABELS, type InterestField } from '@/types/intern';

const interestFields: InterestField[] = [
  'clevelandClinic', 'constructionMgmt', 'biomedical', 'envJustice',
  'envClimate', 'envFieldScience', 'iersCenter', 'magnetManufacturing',
  'educationInternship', 'healthcare', 'videoGames',
];

export default function DemographicsPage() {
  const { interns } = useAppStore();
  const active = useMemo(() => interns.filter(i => i.isNewest), [interns]);

  const stats = useMemo(() => {
    const grades: Record<string, number> = {};
    const schools: Record<string, number> = {};
    const programs: Record<string, number> = {};
    const interestCounts: Record<string, { yes: number; maybe: number; no: number }> = {};

    for (const f of interestFields) {
      interestCounts[f] = { yes: 0, maybe: 0, no: 0 };
    }

    for (const intern of active) {
      grades[intern.grade] = (grades[intern.grade] || 0) + 1;
      const school = intern.otherSchool || intern.school;
      schools[school] = (schools[school] || 0) + 1;
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

    return { grades, schools, programs, interestCounts };
  }, [active]);

  const itInterests = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const intern of active) {
      for (const it of intern.itInterests) {
        counts[it] = (counts[it] || 0) + 1;
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [active]);

  if (active.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Upload intern data to see demographics.</p>
      </div>
    );
  }

  const maxInterest = Math.max(...interestFields.map(f => stats.interestCounts[f].yes + stats.interestCounts[f].maybe));

  return (
    <div className="max-w-5xl mx-auto animate-fade-in space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Demographics & Data Overview</h2>
        <p className="text-xs text-muted-foreground">{active.length} active interns</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Interns" value={active.length} />
        <StatCard label="Schools" value={Object.keys(stats.schools).length} />
        <StatCard label="Grades" value={Object.keys(stats.grades).length} />
        <StatCard label="Duplicates" value={interns.filter(i => i.isDuplicate && i.isNewest).length} />
      </div>

      {/* Grade breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border bg-card p-4 shadow-card">
          <h3 className="text-sm font-semibold text-card-foreground mb-3">By Grade</h3>
          <div className="space-y-2">
            {Object.entries(stats.grades).sort().map(([grade, count]) => (
              <div key={grade} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-12">{grade}</span>
                <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full gradient-primary rounded-full transition-all"
                    style={{ width: `${(count / active.length) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-foreground w-8 text-right">{count}</span>
              </div>
            ))}
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

      {/* Interest breakdown */}
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
                  <div
                    className="h-full bg-success transition-all"
                    style={{ width: `${(yes / total) * 100}%` }}
                    title={`Yes: ${yes}`}
                  />
                  <div
                    className="h-full bg-warning transition-all"
                    style={{ width: `${(maybe / total) * 100}%` }}
                    title={`Maybe: ${maybe}`}
                  />
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
