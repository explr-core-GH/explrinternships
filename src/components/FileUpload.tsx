import { useCallback, useRef } from 'react';
import { Upload, FileSpreadsheet } from 'lucide-react';
import { parseExcelFile } from '@/lib/parseExcel';
import { useAppStore } from '@/store/useAppStore';
import { toast } from 'sonner';

interface FileUploadProps {
  onComplete?: () => void;
}

export default function FileUpload({ onComplete }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { uploadExcelInterns } = useAppStore();

  const handleFile = useCallback(async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseExcelFile(buffer);
      
      if (parsed.length === 0) {
        toast.error('No intern data found in file');
        return;
      }

      const dupes = parsed.filter(i => i.isDuplicate).length;
      await uploadExcelInterns(parsed);

      toast.success(`Loaded ${parsed.length} interns${dupes > 0 ? ` (${dupes} duplicates detected)` : ''}`);
      onComplete?.();
    } catch (err) {
      console.error(err);
      toast.error('Failed to parse Excel file');
    }
  }, [uploadExcelInterns, onComplete]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className="border-2 border-dashed border-border rounded-lg p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-colors"
    >
      <div className="h-12 w-12 rounded-full bg-accent flex items-center justify-center">
        <Upload className="h-5 w-5 text-accent-foreground" />
      </div>
      <div className="text-center">
        <p className="font-medium text-sm text-foreground">
          Drop Excel file here or click to browse
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Supports .xlsx and .xls files
        </p>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <FileSpreadsheet className="h-3.5 w-3.5" />
        <span>Data will be uploaded to the database</span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
