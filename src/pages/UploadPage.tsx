import FileUpload from '@/components/FileUpload';
import { useAppStore } from '@/store/useAppStore';

export default function UploadPage() {
  const { interns } = useAppStore();

  return (
    <div className="max-w-lg mx-auto animate-fade-in">
      <h2 className="text-xl font-bold text-foreground mb-1">Upload Data</h2>
      <p className="text-xs text-muted-foreground mb-6">
        Upload new or updated Excel files. Data will be merged — duplicates are detected by name and the newest entry is used.
      </p>

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium text-foreground mb-2">Merge with existing data</h3>
          <FileUpload mode="merge" />
        </div>

        <div>
          <h3 className="text-sm font-medium text-foreground mb-2">Replace all data</h3>
          <FileUpload mode="replace" />
        </div>

        {interns.length > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            Currently have {interns.filter(i => i.isNewest).length} active intern records.
          </p>
        )}
      </div>
    </div>
  );
}
