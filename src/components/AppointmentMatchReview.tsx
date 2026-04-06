import { AlertTriangle, CheckCircle2, Mail, UserRound, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { AppointmentReviewItem } from '@/lib/appointmentMatching';

interface AppointmentMatchReviewProps {
  items: AppointmentReviewItem[];
  applying: boolean;
  onApprove: (index: number) => void;
  onReject: (index: number) => void;
  onApplyApproved: () => void;
}

export default function AppointmentMatchReview({
  items,
  applying,
  onApprove,
  onReject,
  onApplyApproved,
}: AppointmentMatchReviewProps) {
  if (items.length === 0) return null;

  const approvedCount = items.filter((item) => item.approved === true).length;
  const pendingCount = items.filter((item) => item.approved === undefined).length;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-primary" />
              Review possible appointment matches
            </CardTitle>
            <CardDescription>
              Compare the uploaded full name, email, and birthdate with the suggested roster card, then click yes or no.
            </CardDescription>
          </div>
          <Button onClick={onApplyApproved} disabled={approvedCount === 0 || applying} size="sm" className="gap-1.5">
            <CheckCircle2 className="h-4 w-4" />
            {applying ? 'Applying...' : `Apply approved (${approvedCount})`}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{pendingCount} pending</Badge>
          <Badge variant="outline">{approvedCount} approved</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item, index) => (
          <div key={`${item.appointment.uploadedName}-${item.suggestion.internId}-${index}`} className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Uploaded row</p>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2 text-foreground">
                    <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{item.appointment.uploadedName || 'Unnamed student'}</span>
                  </div>
                  {item.appointment.dob && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" />
                      <span>{item.appointment.dob}</span>
                    </div>
                  )}
                  {item.appointment.email && (
                    <div className="flex items-center gap-2 text-muted-foreground break-all">
                      <Mail className="h-3.5 w-3.5" />
                      <span>{item.appointment.email}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Suggested roster match</p>
                  <Badge variant="outline">{Math.round(item.suggestion.score * 100)}%</Badge>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="text-foreground font-medium">{item.suggestion.internName}</div>
                  {item.suggestion.internDob && <div className="text-muted-foreground">DOB: {item.suggestion.internDob}</div>}
                  {item.suggestion.internEmail && <div className="text-muted-foreground break-all">{item.suggestion.internEmail}</div>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.suggestion.matchedBy.map((reason) => (
                    <Badge key={reason} variant="secondary">{reason}</Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => onApprove(index)} className="gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                Yes, match this student
              </Button>
              <Button size="sm" variant="outline" onClick={() => onReject(index)}>
                No, not a match
              </Button>
              {item.approved === true && <Badge variant="secondary">Approved</Badge>}
              {item.approved === false && <Badge variant="outline">Rejected</Badge>}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
