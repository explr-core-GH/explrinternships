import { useCallback, useRef, useState } from 'react';
import { Upload, FileSpreadsheet, RefreshCw, Check, X, Users } from 'lucide-react';
import { parseExcelFile } from '@/lib/parseExcel';
import { useAppStore } from '@/store/useAppStore';
import { toast } from 'sonner';
import { INTERN_STATUSES, STATUS_CONFIG, type InternStatus } from '@/types/intern';
import type { Intern } from '@/types/intern';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type UploadMode = 'new_interns' | 'status_update';

interface PotentialMatch {
  uploadedName: string;
  uploadedFirstName: string;
  uploadedLastName: string;
  internId: string;
  internName: string;
  similarity: number;
  approved?: boolean;
}

interface FileUploadProps {
  onComplete?: () => void;
}

export default function FileUpload({ onComplete }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { uploadExcelInterns, interns, updateIntern } = useAppStore();
  const [mode, setMode] = useState<UploadMode>('new_interns');
  const [targetStatus, setTargetStatus] = useState<InternStatus>('matched');
  const [processing, setProcessing] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    try {
      setProcessing(true);
      const buffer = await file.arrayBuffer();
      const parsed = parseExcelFile(buffer);

      if (parsed.length === 0) {
        toast.error('No data found in file');
        setProcessing(false);
        return;
      }

      if (mode === 'new_interns') {
        const dupes = parsed.filter(i => i.isDuplicate).length;
        await uploadExcelInterns(parsed);
        toast.success(`Loaded ${parsed.length} interns${dupes > 0 ? ` (${dupes} duplicates detected)` : ''}`);
      } else {
        // Status update mode: match by name, update status, don't add new students
        const activeInterns = interns.filter(i => i.isNewest);
        let matched = 0;
        let notFound: string[] = [];

        for (const row of parsed) {
          const firstName = row.firstName.trim().toLowerCase();
          const lastName = row.lastName.trim().toLowerCase();
          if (!firstName && !lastName) continue;

          // Find matching intern by name (fuzzy: case-insensitive, handles middle names)
          const match = activeInterns.find(i => {
            const dbFirst = i.firstName.toLowerCase().trim();
            const dbLast = i.lastName.toLowerCase().trim();
            
            if (dbFirst === firstName && dbLast === lastName) return true;
            
            // Handle middle names by checking if the first word of the first name matches
            const dbFirstPart = dbFirst.split(' ')[0];
            const uploadFirstPart = firstName.split(' ')[0];
            
            const firstMatch = dbFirstPart === uploadFirstPart || dbFirst.includes(firstName) || firstName.includes(dbFirst);
            const lastMatch = dbLast === lastName || dbLast.includes(lastName) || lastName.includes(dbLast);
            
            return firstMatch && lastMatch;
          });

          if (match) {
            await updateIntern(match.id, { status: targetStatus });
            matched++;
          } else {
            notFound.push(`${row.firstName} ${row.lastName}`);
          }
        }

        if (matched > 0) {
          toast.success(`Updated ${matched} intern(s) to "${STATUS_CONFIG[targetStatus].label}"`);
        }
        if (notFound.length > 0) {
          toast.warning(`${notFound.length} name(s) not found in roster`, {
            description: notFound.slice(0, 5).join(', ') + (notFound.length > 5 ? ` +${notFound.length - 5} more` : ''),
            duration: 8000,
          });
        }
        if (matched === 0 && notFound.length === 0) {
          toast.error('No names found in the uploaded file');
        }
      }

      setProcessing(false);
      onComplete?.();
    } catch (err) {
      console.error(err);
      toast.error('Failed to parse Excel file');
      setProcessing(false);
    }
  }, [uploadExcelInterns, onComplete, mode, targetStatus, interns, updateIntern]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div className="space-y-4">
      {/* Upload mode selector */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setMode('new_interns')}
          className={`p-3 rounded-lg border text-left transition-colors ${mode === 'new_interns' ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-muted-foreground/50'}`}
        >
          <p className="text-sm font-semibold text-foreground">Add New Interns</p>
          <p className="text-xs text-muted-foreground mt-0.5">Import a full roster of students into the database</p>
        </button>
        <button
          onClick={() => setMode('status_update')}
          className={`p-3 rounded-lg border text-left transition-colors ${mode === 'status_update' ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-muted-foreground/50'}`}
        >
          <p className="text-sm font-semibold text-foreground">Update Status</p>
          <p className="text-xs text-muted-foreground mt-0.5">Match names from a report and set their status (no new students added)</p>
        </button>
      </div>

      {/* Status selector for status_update mode */}
      {mode === 'status_update' && (
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Set matched students to:
          </p>
          <div className="flex flex-wrap gap-2">
            {INTERN_STATUSES.filter(s => s !== 'pending').map(status => {
              const config = STATUS_CONFIG[status];
              return (
                <button
                  key={status}
                  onClick={() => setTargetStatus(status)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${
                    targetStatus === status
                      ? `${config.bgClass} ${config.textClass} ${config.borderClass} ring-2 ring-offset-1 ring-offset-background`
                      : `border-border text-muted-foreground hover:${config.textClass}`
                  }`}
                  style={targetStatus === status ? { '--tw-ring-color': config.color } as React.CSSProperties : undefined}
                >
                  {config.label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Upload an Excel file with student names. Each name will be matched against the existing roster and their status will be updated. Students not already in the roster will be skipped.
          </p>
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => !processing && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center gap-3 transition-colors ${
          processing ? 'border-primary/50 bg-primary/5 cursor-wait' : 'border-border cursor-pointer hover:border-primary/50 hover:bg-accent/30'
        }`}
      >
        <div className="h-12 w-12 rounded-full bg-accent flex items-center justify-center">
          {processing ? <RefreshCw className="h-5 w-5 text-accent-foreground animate-spin" /> : <Upload className="h-5 w-5 text-accent-foreground" />}
        </div>
        <div className="text-center">
          <p className="font-medium text-sm text-foreground">
            {processing ? 'Processing...' : mode === 'new_interns' ? 'Drop Excel file to import interns' : 'Drop Excel file to update statuses'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {mode === 'new_interns'
              ? 'Supports .xlsx and .xls — adds students to the roster'
              : `Names will be matched and set to "${STATUS_CONFIG[targetStatus].label}"`
            }
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <FileSpreadsheet className="h-3.5 w-3.5" />
          <span>{mode === 'new_interns' ? 'Full intern data expected' : 'Only needs First Name & Last Name columns'}</span>
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
    </div>
  );
}
