import FileUpload from '@/components/FileUpload';
import GoogleSheetSync from '@/components/GoogleSheetSync';
import { useAppStore } from '@/store/useAppStore';

export default function UploadPage() {
  const { interns } = useAppStore();

  return (
    <div className="max-w-lg mx-auto animate-fade-in space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground mb-1">Upload & Sync Data</h2>
        <p className="text-xs text-muted-foreground">
          Sync from a Google Sheet or upload Excel files. Duplicates are detected by name — the newest entry is used.
        </p>
      </div>

      <GoogleSheetSync />

      <div>
        <h3 className="text-sm font-medium text-foreground mb-2">Or upload an Excel file</h3>
        <FileUpload />
      </div>

      {interns.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Currently have {interns.filter(i => i.isNewest).length} active intern records.
        </p>
      )}
    </div>
  );
}
