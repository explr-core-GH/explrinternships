import { useState, useCallback } from 'react';
import { Upload, CalendarClock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/useAppStore';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import AppointmentMatchReview from '@/components/AppointmentMatchReview';
import {
  buildAppointmentLabel,
  findAutoAppointmentMatch,
  findBestAppointmentSuggestion,
  isUsefulAppointmentSuggestion,
  parseAppointmentFile,
  type AppointmentReviewItem,
  type ParsedAppointment,
} from '@/lib/appointmentMatching';

interface AppointmentUploadResults {
  matched: number;
  unmatched: string[];
}

async function applyAppointmentToIntern(appointment: ParsedAppointment, internId: string, existingEmail?: string) {
  const updateFields: Record<string, string | null> = {
    intake_date: appointment.date || null,
    intake_time: appointment.time || null,
    intake_location: appointment.location || null,
    status: 'in_progress_you',
  };

  if (appointment.email && !existingEmail) {
    updateFields.student_email = appointment.email;
  }

  await supabase.from('interns').update(updateFields).eq('id', internId);
}

export default function AppointmentUpload() {
  const { interns, fetchInterns } = useAppStore();
  const [results, setResults] = useState<AppointmentUploadResults | null>(null);
  const [reviewItems, setReviewItems] = useState<AppointmentReviewItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [applyingReview, setApplyingReview] = useState(false);

  const handleApplyApproved = useCallback(async () => {
    const approvedItems = reviewItems.filter((item) => item.approved === true);
    if (approvedItems.length === 0) {
      toast.error('Approve at least one suggested match first.');
      return;
    }

    setApplyingReview(true);
    try {
      for (const item of approvedItems) {
        const existingIntern = interns.find((intern) => intern.id === item.suggestion.internId);
        await applyAppointmentToIntern(item.appointment, item.suggestion.internId, existingIntern?.studentEmail || existingIntern?.emailSubmission);
      }

      await fetchInterns();
      setResults((previous) => ({
        matched: (previous?.matched || 0) + approvedItems.length,
        unmatched: reviewItems
          .filter((item) => item.approved !== true)
          .map((item) => buildAppointmentLabel(item.appointment)),
      }));
      setReviewItems((previous) => previous.filter((item) => item.approved !== true));
      toast.success(`Applied ${approvedItems.length} approved appointment match${approvedItems.length === 1 ? '' : 'es'}`);
    } catch (error: any) {
      toast.error(`Failed to apply approved matches: ${error.message || 'Unknown error'}`);
    }
    setApplyingReview(false);
  }, [fetchInterns, interns, reviewItems]);

  const handleFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setResults(null);
    setReviewItems([]);

    try {
      const data = await file.arrayBuffer();
      const appointments = parseAppointmentFile(data);

      if (appointments.length === 0) {
        toast.error('No appointment data found. Make sure the file has columns for name, birthdate, date, and time.');
        setUploading(false);
        return;
      }

      const activeInterns = interns.filter((intern) => intern.isNewest);
      let matched = 0;
      const unmatched: string[] = [];
      const nextReviewItems: AppointmentReviewItem[] = [];

      for (const appointment of appointments) {
        const autoMatch = findAutoAppointmentMatch(appointment, activeInterns);

        if (autoMatch) {
          await applyAppointmentToIntern(appointment, autoMatch.id, autoMatch.studentEmail || autoMatch.emailSubmission);
          matched += 1;
          continue;
        }

        const suggestion = findBestAppointmentSuggestion(appointment, activeInterns);
        if (isUsefulAppointmentSuggestion(suggestion)) {
          nextReviewItems.push({
            appointment,
            suggestion,
            approved: suggestion.score >= 0.82 ? true : undefined,
          });
        } else {
          unmatched.push(buildAppointmentLabel(appointment));
        }
      }

      await fetchInterns();
      setReviewItems(nextReviewItems);
      setResults({
        matched,
        unmatched: [
          ...unmatched,
          ...nextReviewItems.filter((item) => item.approved === false).map((item) => buildAppointmentLabel(item.appointment)),
        ],
      });

      if (nextReviewItems.length > 0) {
        toast.success(`Matched ${matched} automatically. Review ${nextReviewItems.length} possible match${nextReviewItems.length === 1 ? '' : 'es'}.`);
      } else {
        toast.success(`Matched ${matched} of ${appointments.length} appointments`);
      }
    } catch (error: any) {
      toast.error(`Failed to parse file: ${error.message || 'Unknown error'}`);
    }

    setUploading(false);
    event.target.value = '';
  }, [fetchInterns, interns]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-medium text-foreground">Upload Intake Appointments</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Upload an Excel file with full names, birthdates, emails, appointment dates/times, and addresses. Exact matches are applied automatically, and uncertain matches go to manual review.
      </p>

      <label className="block">
        <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" disabled={uploading || applyingReview} />
        <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer" asChild disabled={uploading || applyingReview}>
          <span>
            <Upload className="h-3.5 w-3.5" />
            {uploading ? 'Processing...' : 'Choose Appointment File'}
          </span>
        </Button>
      </label>

      {reviewItems.length > 0 && (
        <AppointmentMatchReview
          items={reviewItems}
          applying={applyingReview}
          onApprove={(index) => setReviewItems((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, approved: true } : item))}
          onReject={(index) => setReviewItems((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, approved: false } : item))}
          onApplyApproved={handleApplyApproved}
        />
      )}

      {results && (
        <div className="rounded-md border p-3 space-y-2 bg-muted/30">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <span className="text-foreground font-medium">{results.matched} students matched automatically</span>
          </div>
          {reviewItems.length > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-primary" />
              <span className="text-foreground">{reviewItems.length} records need manual review</span>
            </div>
          )}
          {results.unmatched.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <span className="text-warning font-medium">{results.unmatched.length} not matched:</span>
              </div>
              <ul className="text-xs text-muted-foreground pl-6 list-disc">
                {results.unmatched.map((name, index) => <li key={`${name}-${index}`}>{name}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
