import { useState } from 'react';
import { Undo2 } from 'lucide-react';
import FileUpload from '@/components/FileUpload';
import GoogleSheetSync from '@/components/GoogleSheetSync';
import SchoolContactUpload from '@/components/SchoolContactUpload';
import AppointmentUpload from '@/components/AppointmentUpload';
import GenderUpload from '@/components/GenderUpload';
import { useAppStore } from '@/store/useAppStore';
import { useAutoLoadData } from '@/hooks/useAutoLoadData';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function UploadPage() {
  useAutoLoadData();
  const { interns, canUndoUpload, undoLastUpload } = useAppStore();
  const [undoing, setUndoing] = useState(false);

  const handleUndo = async () => {
    setUndoing(true);
    const success = await undoLastUpload();
    setUndoing(false);
    if (success) {
      toast.success('Last upload undone — data restored to previous state');
    } else {
      toast.error('Failed to undo upload');
    }
  };

  return (
    <div className="max-w-lg mx-auto animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground mb-1">Upload & Sync Data</h2>
          <p className="text-xs text-muted-foreground">
            Sync from a Google Sheet or upload Excel files. Duplicates are detected by name — the newest entry is used.
          </p>
        </div>

        {canUndoUpload && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 shrink-0" disabled={undoing}>
                <Undo2 className="h-3.5 w-3.5" />
                Undo Upload
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Undo last upload?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will restore the intern data to the state before your last upload or sync. This action cannot be reversed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleUndo}>Undo Upload</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <GoogleSheetSync />

      <div>
        <h3 className="text-sm font-medium text-foreground mb-2">Or upload an Excel file</h3>
        <FileUpload />
      </div>

      <div className="border-t pt-6">
        <SchoolContactUpload />
      </div>

      <div className="border-t pt-6">
        <AppointmentUpload />
      </div>

      <div className="border-t pt-6">
        <GenderUpload />
      </div>

      {interns.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Currently have {interns.filter(i => i.isNewest).length} active intern records.
        </p>
      )}
    </div>
  );
}
