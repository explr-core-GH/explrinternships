import { useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useAutoLoadData } from '@/hooks/useAutoLoadData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Building2, CheckCircle2, AlertCircle, FileSpreadsheet, FileText } from 'lucide-react';
import { INTERN_STATUSES, STATUS_CONFIG, type InternStatus } from '@/types/intern';
import { exportProgressMonitoringExcel, exportProgressMonitoringPDF } from '@/lib/exportProgressMonitoring';
import { toast } from 'sonner';

export default function DashboardPage() {
  useAutoLoadData();
  const { interns, worksites, assignments, loading } = useAppStore();

  const active = useMemo(() => interns.filter(i => i.isNewest), [interns]);
  const diffPartnerCount = useMemo(() => active.filter(i => i.status === 'selected_different_partner').length, [active]);
  const removedCount = useMemo(() => active.filter(i => i.status === 'removed').length, [active]);
  const eligible = useMemo(() => active.filter(i => i.status !== 'selected_different_partner' && i.status !== 'removed'), [active]);
  const assignedIds = useMemo(() => new Set(assignments.map(a => a.internId)), [assignments]);
  const assignedCount = eligible.filter(i => assignedIds.has(i.id)).length;
  const unassignedCount = eligible.length - assignedCount;
  const assignPct = eligible.length ? Math.round((assignedCount / eligible.length) * 100) : 0;

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const status of INTERN_STATUSES) {
      counts[status] = 0;
    }
    for (const intern of active) {
      counts[intern.status] = (counts[intern.status] || 0) + 1;
    }
    return counts;
  }, [active]);

  const wsCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    assignments.forEach(a => { counts[a.worksiteId] = (counts[a.worksiteId] || 0) + 1; });
    return counts;
  }, [assignments]);

  const totalCapacity = worksites.reduce((s, w) => s + w.capacity, 0);
  const totalFilled = assignments.length;
  const capacityPct = totalCapacity ? Math.round((totalFilled / totalCapacity) * 100) : 0;

  const sortedWorksites = useMemo(
    () => [...worksites].sort((a, b) => (wsCounts[b.id] || 0) / b.capacity - (wsCounts[a.id] || 0) / a.capacity),
    [worksites, wsCounts]
  );

  if (loading) return <p className="text-center text-sm text-muted-foreground py-12">Loading…</p>;

  return (
    <div className="max-w-5xl mx-auto animate-fade-in space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Dashboard</h2>
          <p className="text-xs text-muted-foreground">Overview of internship placement progress</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              try { exportProgressMonitoringExcel(interns); toast.success('Spreadsheet downloaded'); }
              catch (e) { console.error(e); toast.error('Failed to export spreadsheet'); }
            }}
          >
            <FileSpreadsheet className="h-4 w-4 mr-1.5" />
            Progress Monitoring (Spreadsheet)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              try { exportProgressMonitoringPDF(interns); toast.success('PDF downloaded'); }
              catch (e) { console.error(e); toast.error('Failed to export PDF'); }
            }}
          >
            <FileText className="h-4 w-4 mr-1.5" />
            Progress Monitoring (PDF)
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Interns" value={eligible.length} subNote={(diffPartnerCount > 0 || removedCount > 0) ? `${diffPartnerCount > 0 ? `${diffPartnerCount} w/ different partner` : ''}${diffPartnerCount > 0 && removedCount > 0 ? ', ' : ''}${removedCount > 0 ? `${removedCount} removed` : ''}` : undefined} />
        <StatCard icon={CheckCircle2} label="Assigned" value={assignedCount} sub={`${assignPct}%`} />
        <StatCard icon={AlertCircle} label="Unassigned" value={unassignedCount} variant={unassignedCount > 0 ? 'warning' : 'default'} />
        <StatCard icon={Building2} label="Worksites" value={worksites.length} sub={`${totalFilled}/${totalCapacity} slots`} />
      </div>

      {/* Status breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Status Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2.5">
            {INTERN_STATUSES.map(status => {
              const count = statusCounts[status] || 0;
              const pct = active.length ? Math.round((count / active.length) * 100) : 0;
              const config = STATUS_CONFIG[status];
              return (
                <div key={status} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: config.color }}
                      />
                      <span className="font-medium text-foreground">{config.label}</span>
                    </div>
                    <span className="text-muted-foreground">{count} <span className="text-[10px]">({pct}%)</span></span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: config.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Assignment progress */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Assignment Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{assignedCount} of {eligible.length} interns assigned</span>
            <span className="font-medium text-foreground">{assignPct}%</span>
          </div>
          <Progress value={assignPct} className="h-3" />
        </CardContent>
      </Card>

      {/* Worksite fill rates */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Worksite Fill Rates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {sortedWorksites.map(ws => {
              const filled = wsCounts[ws.id] || 0;
              const pct = ws.capacity ? Math.round((filled / ws.capacity) * 100) : 0;
              return (
                <div key={ws.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{ws.name}</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{ws.category}</Badge>
                    </div>
                    <span className="text-muted-foreground">{filled}/{ws.capacity}</span>
                  </div>
                  <Progress value={pct} className="h-2" />
                </div>
              );
            })}
            {worksites.length === 0 && <p className="text-xs text-muted-foreground">No worksites yet.</p>}
          </div>
        </CardContent>
      </Card>

      {/* Overall capacity */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Overall Capacity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{totalFilled} of {totalCapacity} total slots filled</span>
            <span className="font-medium text-foreground">{capacityPct}%</span>
          </div>
          <Progress value={capacityPct} className="h-3" />
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, subNote, variant = 'default' }: {
  icon: React.ElementType; label: string; value: number; sub?: string; subNote?: string; variant?: 'default' | 'warning';
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${variant === 'warning' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{label}{sub ? ` · ${sub}` : ''}</p>
          {subNote && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{subNote}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

