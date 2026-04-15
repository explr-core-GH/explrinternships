import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Mail, Phone, School, Calendar, AlertTriangle, Star, Copy, Edit2, Save, X, StickyNote, CheckCircle2, Square, CheckSquare, Users, CalendarClock, Trash2, HeartPulse, Award } from 'lucide-react';
import { isEligibleForPreApprenticeship } from '@/lib/preApprenticeship';
import { normalizeSchoolName } from '@/lib/schoolNameNormalizer';
import type { Intern, Placement, Worksite, InternStatus } from '@/types/intern';
import { INTEREST_LABELS, type InterestField, INTERN_STATUSES, STATUS_CONFIG, CONTACT_ROLE_LABELS, type SchoolContactRole } from '@/types/intern';
import { generatePlacements } from '@/lib/placementEngine';
import { useAppStore } from '@/store/useAppStore';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface InternCardProps {
  intern: Intern;
  worksites: Worksite[];
  bulkMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}

const interestFields: InterestField[] = [
  'constructionMgmt', 'biomedical', 'envJustice',
  'envClimate', 'envFieldScience', 'magnetManufacturing',
  'educationInternship', 'healthcare', 'videoGames',
];

function InterestBadge({ value }: { value: string }) {
  if (value === 'Yes') return <Badge variant="default" className="bg-success text-primary-foreground text-xs">Yes</Badge>;
  if (value === 'Maybe') return <Badge variant="secondary" className="bg-warning/20 text-warning text-xs">Maybe</Badge>;
  return <Badge variant="outline" className="text-xs opacity-50">No</Badge>;
}

function PlacementCard({ placement, priority }: { placement: Placement; priority: number }) {
  const colors = [
    'border-l-4 border-l-primary',
    'border-l-4 border-l-info',
    'border-l-4 border-l-muted-foreground',
  ];
  return (
    <div className={`rounded-md surface-elevated p-3 ${colors[priority - 1]} shadow-card`}>
      <div className="flex items-center gap-2 mb-1">
        <Star className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Priority {priority}</span>
      </div>
      <p className="font-semibold text-sm text-foreground">{placement.worksiteName}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{placement.category}</p>
      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed italic">{placement.reasoning}</p>
    </div>
  );
}

function StatusDropdown({ intern }: { intern: Intern }) {
  const { updateIntern } = useAppStore();
  const config = STATUS_CONFIG[intern.status];

  const handleChange = async (newStatus: InternStatus) => {
    await updateIntern(intern.id, { status: newStatus });
    toast.success(`Status → ${STATUS_CONFIG[newStatus].label}`);
  };

  return (
    <select
      value={intern.status}
      onChange={(e) => handleChange(e.target.value as InternStatus)}
      onClick={(e) => e.stopPropagation()}
      className={`h-7 px-2 rounded-md border text-xs font-medium cursor-pointer ${config.bgClass} ${config.textClass} ${config.borderClass}`}
    >
      {INTERN_STATUSES.map(s => (
        <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
      ))}
    </select>
  );
}

function AssignmentSection({ intern, worksites }: { intern: Intern; worksites: Worksite[] }) {
  const { assignments, assignIntern, unassignIntern } = useAppStore();
  const currentAssignment = assignments.find(a => a.internId === intern.id);
  const assignedWorksite = currentAssignment ? worksites.find(w => w.id === currentAssignment.worksiteId) : null;

  const handleAssign = async (worksiteId: string) => {
    if (!worksiteId) {
      await unassignIntern(intern.id);
      toast.success('Assignment removed');
    } else {
      await assignIntern(intern.id, worksiteId);
      toast.success('Intern assigned');
    }
  };

  return (
    <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Manual Assignment</span>
      </div>
      <div className="flex items-center gap-2">
        <select
          value={currentAssignment?.worksiteId || ''}
          onChange={e => handleAssign(e.target.value)}
          className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
        >
          <option value="">— Unassigned —</option>
          {worksites.map(ws => (
            <option key={ws.id} value={ws.id}>
              {ws.name} ({ws.filled}/{ws.capacity})
            </option>
          ))}
        </select>
      </div>
      {assignedWorksite && (
        <p className="text-xs text-primary mt-1.5 font-medium">
          Assigned to: {assignedWorksite.name} · {assignedWorksite.category}
        </p>
      )}
    </div>
  );
}

function SchoolContactsSection({ schoolName }: { schoolName: string }) {
  const { schoolContacts, deleteSchoolContact } = useAppStore();
  const contacts = useMemo(() => {
    if (!schoolName) return [];
    const normalizedSchool = normalizeSchoolName(schoolName);
    const matched = schoolContacts.filter(c => normalizeSchoolName(c.schoolName) === normalizedSchool);
    const seen = new Set<string>();
    return matched.filter(c => {
      const key = `${c.role}|${c.contactName.toLowerCase().trim()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [schoolContacts, schoolName]);

  const handleDelete = useCallback(async (id: string, name: string) => {
    if (window.confirm(`Remove ${name} from school contacts?`)) {
      await deleteSchoolContact(id);
      toast.success(`Removed ${name}`);
    }
  }, [deleteSchoolContact]);

  if (contacts.length === 0) return null;

  const roleBadgeColor: Record<SchoolContactRole, string> = {
    principal: 'bg-primary/10 text-primary',
    guidance_counselor: 'bg-info/10 text-info',
    '5c': 'bg-success/10 text-success',
  };

  return (
    <div className="rounded-md border border-border p-3 bg-muted/30">
      <div className="flex items-center gap-1.5 mb-2">
        <Users className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">School Contacts</span>
      </div>
      <div className="space-y-1.5">
        {contacts.map(c => (
          <div key={c.id} className="flex items-center gap-2 text-xs group">
            <Badge variant="outline" className={`text-[10px] shrink-0 ${roleBadgeColor[c.role]}`}>{CONTACT_ROLE_LABELS[c.role]}</Badge>
            <span className="font-medium text-foreground">{c.contactName}</span>
            {c.contactEmail && (
              <a href={`mailto:${c.contactEmail}`} className="text-primary hover:underline truncate">{c.contactEmail}</a>
            )}
            <span className="text-[10px] text-muted-foreground italic shrink-0">({c.schoolName})</span>
            <button
              onClick={() => handleDelete(c.id, c.contactName)}
              className="opacity-0 group-hover:opacity-100 transition-opacity ml-auto shrink-0 text-destructive hover:text-destructive/80"
              title="Remove contact"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function InternCard({ intern, worksites, bulkMode, selected, onToggleSelect }: InternCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: intern.firstName, lastName: intern.lastName,
    phone: intern.phone, parentPhone: intern.parentPhone,
    studentEmail: intern.studentEmail, dob: intern.dob,
    school: intern.school, otherSchool: intern.otherSchool,
    grade: intern.grade, specificInterests: intern.specificInterests,
  });
  const [notes, setNotes] = useState(intern.adminNotes || '');
  const [editingNotes, setEditingNotes] = useState(false);
  const { updateIntern, assignments } = useAppStore();

  const placements = useCallback(() => generatePlacements(intern, worksites), [intern, worksites]);
  const displaySchool = intern.otherSchool || intern.school;
  const initials = `${intern.firstName[0] || ''}${intern.lastName[0] || ''}`.toUpperCase();
  const isAssigned = assignments.some(a => a.internId === intern.id);
  const statusConfig = STATUS_CONFIG[intern.status];
  const hasCrystalReed = intern.itInterests.some(i => i.toLowerCase().includes('crystal reed'));
  const preAppEligible = isEligibleForPreApprenticeship(intern.dob);

  const handleSaveEdit = async () => {
    await updateIntern(intern.id, editForm);
    setEditing(false);
    toast.success('Intern updated');
  };

  const handleSaveNotes = async () => {
    await updateIntern(intern.id, { adminNotes: notes });
    setEditingNotes(false);
    toast.success('Notes saved');
  };

  // Card border color based on status
  const borderColor = intern.status !== 'pending' ? `border-l-4 ${statusConfig.borderClass}` : '';

  return (
    <motion.div layout className={`rounded-lg border bg-card shadow-card hover:shadow-card-hover transition-shadow duration-200 overflow-hidden ${borderColor}`}>
      <button
        onClick={() => bulkMode ? onToggleSelect?.() : setExpanded(!expanded)}
        className="w-full flex items-center gap-4 p-4 text-left hover:bg-accent/30 transition-colors"
      >
        {bulkMode && (
          <div className="shrink-0" onClick={(e) => { e.stopPropagation(); onToggleSelect?.(); }}>
            {selected ? <CheckSquare className="h-5 w-5 text-primary" /> : <Square className="h-5 w-5 text-muted-foreground" />}
          </div>
        )}
        <div className="h-10 w-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-semibold text-sm shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-card-foreground truncate">{intern.firstName} {intern.lastName}</h3>
            {intern.isEll && <span title="English Language Learner (ELL)">🟢</span>}
            {hasCrystalReed && <span title="Healthcare (Crystal Reed)"><HeartPulse className="h-4 w-4 text-destructive shrink-0" /></span>}
            {preAppEligible && (
              <span title="Eligible for Pre-Apprenticeship (16+ by June 5)" className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-warning/20 text-warning text-[10px] font-semibold shrink-0">
                <Award className="h-3 w-3" /> PreApp
              </span>
            )}
            {intern.isDuplicate && <Copy className="h-3.5 w-3.5 text-warning shrink-0" />}
            {intern.adminNotes && <StickyNote className="h-3.5 w-3.5 text-primary shrink-0" />}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {displaySchool} · {intern.grade} grade
            {intern.intakeDate && <span className="ml-1.5 text-primary">· 📅 {intern.intakeDate}{intern.intakeTime ? ` ${intern.intakeTime}` : ''}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusDropdown intern={intern} />
          {!bulkMode && (
            <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </motion.div>
          )}
        </div>
      </button>

      <AnimatePresence>
        {expanded && !bulkMode && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
            <div className="px-4 pb-4 space-y-4 border-t pt-4">
              {intern.isDuplicate && (
                <div className="flex items-center gap-2 p-2.5 rounded-md bg-warning/10 border border-warning/20">
                  <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                  <p className="text-xs text-warning">Duplicate entry detected — this is the newest submission.</p>
                </div>
              )}

              <AssignmentSection intern={intern} worksites={worksites} />

              <div className="flex justify-end">
                {!editing ? (
                  <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setEditing(true); }} className="gap-1.5 text-xs">
                    <Edit2 className="h-3 w-3" /> Edit Info
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveEdit} className="gap-1.5 text-xs"><Save className="h-3 w-3" /> Save</Button>
                    <Button variant="outline" size="sm" onClick={() => setEditing(false)} className="gap-1.5 text-xs"><X className="h-3 w-3" /> Cancel</Button>
                  </div>
                )}
              </div>

              {editing ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className="text-[10px] text-muted-foreground uppercase">First Name</label><Input value={editForm.firstName} onChange={e => setEditForm({...editForm, firstName: e.target.value})} className="h-8 text-sm" /></div>
                  <div><label className="text-[10px] text-muted-foreground uppercase">Last Name</label><Input value={editForm.lastName} onChange={e => setEditForm({...editForm, lastName: e.target.value})} className="h-8 text-sm" /></div>
                  <div><label className="text-[10px] text-muted-foreground uppercase">Email</label><Input value={editForm.studentEmail} onChange={e => setEditForm({...editForm, studentEmail: e.target.value})} className="h-8 text-sm" /></div>
                  <div><label className="text-[10px] text-muted-foreground uppercase">Phone</label><Input value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} className="h-8 text-sm" /></div>
                  <div><label className="text-[10px] text-muted-foreground uppercase">Parent Phone</label><Input value={editForm.parentPhone} onChange={e => setEditForm({...editForm, parentPhone: e.target.value})} className="h-8 text-sm" /></div>
                  <div><label className="text-[10px] text-muted-foreground uppercase">DOB</label><Input value={editForm.dob} onChange={e => setEditForm({...editForm, dob: e.target.value})} className="h-8 text-sm" /></div>
                  <div><label className="text-[10px] text-muted-foreground uppercase">School</label><Input value={editForm.school} onChange={e => setEditForm({...editForm, school: e.target.value})} className="h-8 text-sm" /></div>
                  <div><label className="text-[10px] text-muted-foreground uppercase">Grade</label><Input value={editForm.grade} onChange={e => setEditForm({...editForm, grade: e.target.value})} className="h-8 text-sm" /></div>
                  <div className="sm:col-span-2"><label className="text-[10px] text-muted-foreground uppercase">Specific Interests</label><Input value={editForm.specificInterests} onChange={e => setEditForm({...editForm, specificInterests: e.target.value})} className="h-8 text-sm" /></div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 text-sm"><Mail className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-muted-foreground truncate">{intern.studentEmail || intern.emailSubmission || '—'}</span></div>
                    <div className="flex items-center gap-2 text-sm"><Phone className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-muted-foreground">{intern.phone || '—'}</span></div>
                    <div className="flex items-center gap-2 text-sm"><School className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-muted-foreground truncate">{displaySchool || '—'}</span></div>
                    <div className="flex items-center gap-2 text-sm"><Calendar className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-muted-foreground">DOB: {intern.dob || '—'}</span></div>
                  </div>

                  {(intern.gender || intern.raceEthnicity || intern.parentGuardianEmail || intern.parentGuardianPhone || intern.parentPhone) && (
                    <div className="rounded-md border border-border p-3 bg-muted/30">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Users className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Demographics & Guardian Info</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                        {intern.gender && (
                          <div><span className="text-[10px] text-muted-foreground uppercase">Gender</span><p className="text-foreground">{intern.gender}</p></div>
                        )}
                        {intern.raceEthnicity && (
                          <div><span className="text-[10px] text-muted-foreground uppercase">Race / Ethnicity</span><p className="text-foreground">{intern.raceEthnicity}</p></div>
                        )}
                        {(intern.parentGuardianPhone || intern.parentPhone) && (
                          <div><span className="text-[10px] text-muted-foreground uppercase">Parent/Guardian Phone</span><p className="text-foreground">{intern.parentGuardianPhone || intern.parentPhone}</p></div>
                        )}
                        {intern.parentGuardianEmail && (
                          <div><span className="text-[10px] text-muted-foreground uppercase">Parent/Guardian Email</span><p className="text-foreground truncate">{intern.parentGuardianEmail}</p></div>
                        )}
                      </div>
                    </div>
                  )}

                  {(intern.intakeDate || intern.intakeTime) && (
                    <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <CalendarClock className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Intake Appointment</span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        {intern.intakeDate && <span className="text-foreground font-medium">{intern.intakeDate}</span>}
                        {intern.intakeTime && <span className="text-foreground">{intern.intakeTime}</span>}
                        {intern.intakeLocation && <span className="text-muted-foreground">@ {intern.intakeLocation}</span>}
                      </div>
                    </div>
                  )}

                  <SchoolContactsSection schoolName={displaySchool} />
                </>
              )}

              <div className="rounded-md border border-border p-3 bg-muted/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <StickyNote className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Admin Notes</span>
                  </div>
                  {!editingNotes ? (
                    <button onClick={() => setEditingNotes(true)} className="text-xs text-primary hover:underline">{notes ? 'Edit' : 'Add note'}</button>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={handleSaveNotes} className="text-xs text-primary hover:underline">Save</button>
                      <button onClick={() => { setEditingNotes(false); setNotes(intern.adminNotes || ''); }} className="text-xs text-muted-foreground hover:underline">Cancel</button>
                    </div>
                  )}
                </div>
                {editingNotes ? (
                  <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add notes about this intern..." className="text-sm min-h-[60px]" />
                ) : (
                  <p className="text-xs text-foreground whitespace-pre-wrap">{notes || <span className="italic text-muted-foreground">No notes yet</span>}</p>
                )}
              </div>

              {intern.programs.length > 0 && intern.programs[0] !== 'Not Applicable/None' && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Programs</p>
                  <div className="flex flex-wrap gap-1.5">{intern.programs.map((p) => <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>)}</div>
                </div>
              )}

              {intern.itInterests.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">IT Interests</p>
                  <div className="flex flex-wrap gap-1.5">{intern.itInterests.map((it) => <Badge key={it} variant="outline" className="text-xs">{it}</Badge>)}</div>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Internship Interests</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                  {interestFields.map((field) => (
                    <div key={field} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{INTEREST_LABELS[field]}</span>
                      <InterestBadge value={intern[field]} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-xs"><span className="font-semibold text-muted-foreground">CS/IT Course: </span><span className="text-foreground">{intern.csCourseTaken || 'N/A'}</span></div>

              {intern.specificInterests && intern.specificInterests.toLowerCase() !== 'no' && (
                <div className="text-xs"><span className="font-semibold text-muted-foreground">Specific Interests: </span><span className="text-foreground">{intern.specificInterests}</span></div>
              )}

              {intern.additionalQuestions && intern.additionalQuestions.toLowerCase() !== 'no' && intern.additionalQuestions.toLowerCase() !== 'none' && intern.additionalQuestions.toLowerCase() !== 'n/a' && (
                <div className="text-xs"><span className="font-semibold text-muted-foreground">Student Questions: </span><span className="text-foreground italic">{intern.additionalQuestions}</span></div>
              )}

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Suggested Placements</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {placements().map((p) => <PlacementCard key={p.priority} placement={p} priority={p.priority} />)}
                  {placements().length === 0 && (
                    <p className="text-xs text-muted-foreground italic col-span-3">No matching placements found. Add worksites to generate suggestions.</p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
