import { useCallback, useRef, useState } from 'react';
import { Upload, FileSpreadsheet, RefreshCw, Check, X, Users, Download } from 'lucide-react';
import { parseExcelFile } from '@/lib/parseExcel';
import { useAppStore } from '@/store/useAppStore';
import { toast } from 'sonner';
import { INTERN_STATUSES, STATUS_CONFIG, type InternStatus } from '@/types/intern';
import type { Intern } from '@/types/intern';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { exportMatchReviewCSV } from '@/lib/exportData';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  const [potentialMatches, setPotentialMatches] = useState<PotentialMatch[]>([]);
  const [showingReview, setShowingReview] = useState(false);
  const [exactMatches, setExactMatches] = useState<number>(0);
  const [noMatches, setNoMatches] = useState<string[]>([]);
  const [missingFromSpreadsheet, setMissingFromSpreadsheet] = useState<string[]>([]);
  const [showAllMatches, setShowAllMatches] = useState(false);

  // Simple similarity calculation
  const calculateSimilarity = (str1: string, str2: string): number => {
    const normalize = (s: string) => s.toLowerCase().trim();
    const norm1 = normalize(str1);
    const norm2 = normalize(str2);
    
    // Debug logging for exact match issues
    if (str1 === 'DEBUG_MATCH' || str2 === 'DEBUG_MATCH') {
      console.log(`[DEBUG] Comparing "${str1}" vs "${str2}"`);
      console.log(`[DEBUG] Normalized: "${norm1}" vs "${norm2}"`);
      console.log(`[DEBUG] Exact match: ${norm1 === norm2}`);
    }
    
    if (norm1 === norm2) return 1.0;
    
    // Check if one contains the other (for middle names, etc.)
    if (norm1.includes(norm2) || norm2.includes(norm1)) return 0.8;
    
    // Check first few characters
    const prefix1 = norm1.substring(0, 3);
    const prefix2 = norm2.substring(0, 3);
    if (prefix1 === prefix2) return 0.6;
    
    return 0.0;
  };

  const findPotentialMatches = (firstName: string, lastName: string, activeInterns: Intern[], showAll: boolean = false): PotentialMatch[] => {
    const matches: PotentialMatch[] = [];
    
    // Debug: Log the uploaded name we're trying to match
    console.log(`[MATCH DEBUG] Looking for matches for: "${firstName}" "${lastName}"`);
    
    for (const intern of activeInterns) {
      const firstSim = calculateSimilarity(firstName, intern.firstName);
      const lastSim = calculateSimilarity(lastName, intern.lastName);
      const overallSim = (firstSim * 0.4) + (lastSim * 0.6);
      
      // Debug: Log each comparison
      if (overallSim >= 0.6 || showAll) {
        console.log(`[MATCH DEBUG] Comparing with intern: "${intern.firstName}" "${intern.lastName}"`);
        console.log(`[MATCH DEBUG] First name sim: ${firstSim}, Last name sim: ${lastSim}, Overall: ${overallSim}`);
      }
      
      // When showAll is true, include ALL matches regardless of similarity
      // Otherwise only show matches with >= 60% similarity
      if (showAll || overallSim >= 0.6) {
        matches.push({
          uploadedName: `${firstName} ${lastName}`,
          uploadedFirstName: firstName,
          uploadedLastName: lastName,
          internId: intern.id,
          internName: `${intern.firstName} ${intern.lastName}`,
          similarity: overallSim,
        });
      }
    }
    
    return matches.sort((a, b) => b.similarity - a.similarity);
  };

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
        setProcessing(false);
        onComplete?.();
      } else {
        // Status update mode with manual review
        const activeInterns = interns.filter(i => i.isNewest);
        console.log(`[INTERN DEBUG] Found ${activeInterns.length} active interns in database:`);
        activeInterns.forEach(intern => console.log(`  - "${intern.firstName}" "${intern.lastName}"`));
        
        let exactMatchCount = 0;
        let potentialMatchList: PotentialMatch[] = [];
        let noMatchList: string[] = [];
        let matchedInternIds = new Set<string>();

        for (const row of parsed) {
          const firstName = row.firstName.trim();
          const lastName = row.lastName.trim();
          console.log(`[EXCEL DEBUG] Parsed from Excel: firstName="${firstName}", lastName="${lastName}"`);
          if (!firstName && !lastName) continue;

          if (showAllMatches) {
            // showAllMatches: every uploaded row gets shown with its best % match
            let bestSimilarity = -1;
            let bestInternId = '';
            let bestInternName = 'No roster available';

            for (const intern of activeInterns) {
              const firstSim = calculateSimilarity(firstName, intern.firstName);
              const lastSim = calculateSimilarity(lastName, intern.lastName);
              const overallSim = (firstSim * 0.4) + (lastSim * 0.6);
              
              if (overallSim > bestSimilarity) {
                bestSimilarity = overallSim;
                bestInternId = intern.id;
                bestInternName = `${intern.firstName} ${intern.lastName}`;
              }
            }

            const finalSimilarity = bestSimilarity < 0 ? 0 : bestSimilarity;
            const entry: PotentialMatch = {
              uploadedName: `${firstName} ${lastName}`,
              uploadedFirstName: firstName,
              uploadedLastName: lastName,
              internId: bestInternId,
              internName: bestInternName,
              similarity: finalSimilarity,
              approved: finalSimilarity >= 1.0 ? true : undefined
            };

            if (bestInternId) {
              matchedInternIds.add(bestInternId);
            }
            potentialMatchList.push(entry);
            if (finalSimilarity >= 1.0) {
              exactMatchCount++;
            }
          } else {
            // Normal mode with thresholds
            const potentials = findPotentialMatches(firstName, lastName, activeInterns, false);
            
            if (potentials.length > 0) {
              const bestMatch = potentials[0];
              
              if (bestMatch.similarity >= 0.7) {
                matchedInternIds.add(bestMatch.internId);
                await updateIntern(bestMatch.internId, { status: targetStatus });
                exactMatchCount++;
              } else if (bestMatch.similarity >= 0.6) {
                matchedInternIds.add(bestMatch.internId);
                potentialMatchList.push(bestMatch);
              } else {
                noMatchList.push(`${firstName} ${lastName}`);
              }
            } else {
              noMatchList.push(`${firstName} ${lastName}`);
            }
          }
        }

        // Calculate roster names not found in spreadsheet
        const missingRosterNames = activeInterns
          .filter(intern => !matchedInternIds.has(intern.id))
          .map(intern => `${intern.firstName} ${intern.lastName}`);

        setExactMatches(exactMatchCount);
        setPotentialMatches(potentialMatchList);
        setNoMatches(noMatchList);
        setMissingFromSpreadsheet(missingRosterNames);
        setProcessing(false);
        
        if (potentialMatchList.length > 0 || showAllMatches) {
          setShowingReview(true);
        } else {
          // No manual review needed
          if (exactMatchCount > 0) {
            toast.success(`Updated ${exactMatchCount} intern(s) to "${STATUS_CONFIG[targetStatus].label}"`);
          }
          if (noMatchList.length > 0) {
            toast.warning(`${noMatchList.length} name(s) not found`);
          }
          onComplete?.();
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to parse Excel file');
      setProcessing(false);
    }
  }, [uploadExcelInterns, onComplete, mode, targetStatus, interns, updateIntern, showAllMatches]);

  const handleApprove = (index: number) => {
    setPotentialMatches(prev => prev.map((match, i) => 
      i === index ? { ...match, approved: true } : match
    ));
  };

  const handleReject = (index: number) => {
    setPotentialMatches(prev => prev.map((match, i) => 
      i === index ? { ...match, approved: false } : match
    ));
  };

  const applyApprovedMatches = async () => {
    setProcessing(true);
    const approved = potentialMatches.filter(m => m.approved === true);
    
    for (const match of approved) {
      await updateIntern(match.internId, { status: targetStatus });
    }

    const totalUpdated = exactMatches + approved.length;
    const rejected = potentialMatches.filter(m => m.approved === false);
    const allNoMatches = [...noMatches, ...rejected.map(r => r.uploadedName)];

    if (totalUpdated > 0) {
      toast.success(`Updated ${totalUpdated} intern(s) to "${STATUS_CONFIG[targetStatus].label}"`);
    }
    if (allNoMatches.length > 0) {
      toast.warning(`${allNoMatches.length} name(s) not matched`);
    }

    // Reset state
    setShowingReview(false);
    setPotentialMatches([]);
    setExactMatches(0);
    setNoMatches([]);
    setMissingFromSpreadsheet([]);
    setProcessing(false);
    onComplete?.();
  };

  const handleDownloadReview = () => {
    exportMatchReviewCSV(potentialMatches, exactMatches, noMatches, STATUS_CONFIG[targetStatus].label);
    toast.success('Match review downloaded as CSV');
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  if (showingReview) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 p-4 border rounded-lg bg-card">
          <Users className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-semibold text-foreground">Match Review</h3>
            <p className="text-sm text-muted-foreground">
              {!showAllMatches && exactMatches > 0 && `${exactMatches} exact matches applied automatically. `}
              Review {potentialMatches.length} match{potentialMatches.length !== 1 ? 'es' : ''} below.
              {showAllMatches && <span className="text-primary"> (Showing all matches including low confidence)</span>}
            </p>
          </div>
        </div>

        <div className="border rounded-lg bg-card">
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Uploaded Name</TableHead>
                  <TableHead>Potential Match</TableHead>
                  <TableHead>Similarity</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {potentialMatches.map((match, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{match.uploadedName}</TableCell>
                    <TableCell>{match.internName}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        match.similarity >= 1.0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' :
                        match.similarity >= 0.9 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                        match.similarity >= 0.7 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                        match.similarity >= 0.6 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' :
                        match.similarity >= 0.4 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                        'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                      }`}>
                        {match.similarity >= 1.0 ? '100%' : `${Math.round(match.similarity * 100)}%`}
                        {match.similarity >= 1.0 && <span className="ml-1 text-xs">Exact</span>}
                        {match.similarity < 0.6 && <span className="ml-1 text-xs">Low</span>}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant={match.approved === true ? "default" : "outline"}
                          onClick={() => handleApprove(index)}
                          className="h-8"
                        >
                          <Check className="h-3 w-3" />
                          Yes
                        </Button>
                        <Button
                          size="sm"
                          variant={match.approved === false ? "destructive" : "outline"}
                          onClick={() => handleReject(index)}
                          className="h-8"
                        >
                          <X className="h-3 w-3" />
                          No
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>

        {(noMatches.length > 0 || missingFromSpreadsheet.length > 0) && (
          <div className="border rounded-lg bg-card">
            <Tabs defaultValue="not-in-roster" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="not-in-roster">Names Not in Roster ({noMatches.length})</TabsTrigger>
                <TabsTrigger value="missing-from-sheet">Missing from Spreadsheet ({missingFromSpreadsheet.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="not-in-roster" className="p-3">
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  Names from spreadsheet with no close matches in roster:
                </p>
                <p className="text-xs text-muted-foreground">
                  {noMatches.length > 0 ? (
                    <>
                      {noMatches.slice(0, 10).join(', ')}
                      {noMatches.length > 10 ? ` +${noMatches.length - 10} more` : ''}
                    </>
                  ) : (
                    'All names from spreadsheet were matched!'
                  )}
                </p>
              </TabsContent>
              <TabsContent value="missing-from-sheet" className="p-3">
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  Roster names not found in spreadsheet:
                </p>
                <p className="text-xs text-muted-foreground">
                  {missingFromSpreadsheet.length > 0 ? (
                    <>
                      {missingFromSpreadsheet.slice(0, 10).join(', ')}
                      {missingFromSpreadsheet.length > 10 ? ` +${missingFromSpreadsheet.length - 10} more` : ''}
                    </>
                  ) : (
                    'All roster names were found in the spreadsheet!'
                  )}
                </p>
              </TabsContent>
            </Tabs>
          </div>
        )}

        <div className="flex gap-2 pt-4">
          <Button
            onClick={applyApprovedMatches}
            disabled={processing || !potentialMatches.some(m => m.approved === true)}
            className="flex-1"
          >
            {processing ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
            Apply {potentialMatches.filter(m => m.approved === true).length} Approved Matches
          </Button>
          <Button
            variant="outline"
            onClick={handleDownloadReview}
            className="gap-1.5"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setShowingReview(false);
              setPotentialMatches([]);
              setExactMatches(0);
              setNoMatches([]);
              setMissingFromSpreadsheet([]);
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

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
        <div className="space-y-3">
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
          </div>
          
          <div className="rounded-lg border bg-card p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Review Options
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Choose how to handle matching
                </p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showAllMatches}
                  onChange={(e) => setShowAllMatches(e.target.checked)}
                  className="rounded border border-input"
                />
                <span className="text-xs text-foreground">Show all matches with percentages</span>
              </label>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {showAllMatches 
                ? 'All matches will be shown for manual review with similarity percentages, including exact matches.'
                : 'Only uncertain matches will require manual review. Exact matches will be applied automatically.'
              }
            </p>
          </div>
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
