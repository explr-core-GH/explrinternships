import { useCallback, useRef, useState } from 'react';
import { Upload, FileSpreadsheet, RefreshCw, Users, Trash2 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { CONTACT_ROLE_LABELS, type SchoolContactRole } from '@/types/intern';
import * as XLSX from 'xlsx';

function parseContactsExcel(buffer: ArrayBuffer): { schoolName: string; role: SchoolContactRole; contactName: string; contactEmail: string }[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  const contacts: { schoolName: string; role: SchoolContactRole; contactName: string; contactEmail: string }[] = [];

  for (const row of rows) {
    const schoolName = String(row['School'] || row['school'] || row['School Name'] || row['school_name'] || '').trim();
    if (!schoolName) continue;

    // Parse role - flexible matching
    const rawRole = String(row['Role'] || row['role'] || row['Type'] || row['type'] || '').trim().toLowerCase();
    let role: SchoolContactRole = '5c';
    if (rawRole.includes('principal')) role = 'principal';
    else if (rawRole.includes('guidance') || rawRole.includes('counselor') && !rawRole.includes('5c') && !rawRole.includes('career')) role = 'guidance_counselor';
    else if (rawRole.includes('5c') || rawRole.includes('career')) role = '5c';

    const contactName = String(row['Name'] || row['name'] || row['Contact Name'] || row['contact_name'] || '').trim();
    const contactEmail = String(row['Email'] || row['email'] || row['Contact Email'] || row['contact_email'] || '').trim();

    if (contactName || contactEmail) {
      contacts.push({ schoolName, role, contactName, contactEmail });
    }
  }

  return contacts;
}

export default function SchoolContactUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { schoolContacts, uploadSchoolContacts, fetchSchoolContacts } = useAppStore();
  const [processing, setProcessing] = useState(false);
  const [preview, setPreview] = useState<{ schoolName: string; role: SchoolContactRole; contactName: string; contactEmail: string }[] | null>(null);

  const handleFile = useCallback(async (file: File) => {
    try {
      setProcessing(true);
      const buffer = await file.arrayBuffer();
      const parsed = parseContactsExcel(buffer);

      if (parsed.length === 0) {
        toast.error('No contacts found. Ensure columns: School, Role, Name, Email');
        setProcessing(false);
        return;
      }

      setPreview(parsed);
      setProcessing(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to parse Excel file');
      setProcessing(false);
    }
  }, []);

  const handleConfirmUpload = async () => {
    if (!preview) return;
    setProcessing(true);
    await uploadSchoolContacts(preview);
    toast.success(`Uploaded ${preview.length} school contacts`);
    setPreview(null);
    setProcessing(false);
  };

  const handleClearAll = async () => {
    setProcessing(true);
    await uploadSchoolContacts([]);
    toast.success('All school contacts cleared');
    setProcessing(false);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const roleBadgeColor: Record<SchoolContactRole, string> = {
    principal: 'bg-primary/10 text-primary border-primary/20',
    guidance_counselor: 'bg-info/10 text-info border-info/20',
    '5c': 'bg-success/10 text-success border-success/20',
  };

  if (preview) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 p-3 border rounded-lg bg-card">
          <Users className="h-4 w-4 text-primary" />
          <div>
            <h4 className="text-sm font-semibold text-foreground">Preview: {preview.length} contacts</h4>
            <p className="text-xs text-muted-foreground">Review before uploading. This will replace all existing contacts.</p>
          </div>
        </div>

        <div className="border rounded-lg bg-card">
          <ScrollArea className="h-[250px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>School</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs font-medium">{c.schoolName}</TableCell>
                    <TableCell><Badge variant="outline" className={`text-xs ${roleBadgeColor[c.role]}`}>{CONTACT_ROLE_LABELS[c.role]}</Badge></TableCell>
                    <TableCell className="text-xs">{c.contactName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.contactEmail}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleConfirmUpload} disabled={processing} className="flex-1">
            {processing ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
            Upload {preview.length} Contacts
          </Button>
          <Button variant="outline" onClick={() => setPreview(null)}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold text-foreground">School Contacts</h4>
        </div>
        {schoolContacts.length > 0 && (
          <span className="text-xs text-muted-foreground">{schoolContacts.length} contacts loaded</span>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Upload an Excel file with columns: <strong>School</strong>, <strong>Role</strong> (Principal, Guidance Counselor, or 5C), <strong>Name</strong>, <strong>Email</strong>.
        Contacts will appear on matching intern cards.
      </p>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center cursor-pointer hover:border-primary/40 hover:bg-accent/20 transition-colors"
      >
        <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        {processing ? (
          <RefreshCw className="h-6 w-6 text-primary mx-auto animate-spin" />
        ) : (
          <>
            <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Drop Excel/CSV file or click to browse</p>
          </>
        )}
      </div>

      {schoolContacts.length > 0 && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" className="text-xs text-destructive gap-1.5" onClick={handleClearAll} disabled={processing}>
            <Trash2 className="h-3 w-3" /> Clear All Contacts
          </Button>
        </div>
      )}
    </div>
  );
}
