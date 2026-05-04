export const INTERN_STATUSES = ['pending', 'not_matched', 'matched', 'ready_to_place', 'assigned', 'in_progress_you', 'intake_issue', 'selected_different_partner', 'removed'] as const;
export type InternStatus = typeof INTERN_STATUSES[number];

export const STATUS_CONFIG: Record<InternStatus, { label: string; color: string; bgClass: string; textClass: string; borderClass: string }> = {
  pending:                 { label: 'Pending',                        color: 'hsl(var(--status-pending))',           bgClass: 'bg-muted',                            textClass: 'text-muted-foreground',             borderClass: 'border-status-pending' },
  not_matched:             { label: 'Not Matched',                    color: 'hsl(var(--status-not-matched))',       bgClass: 'bg-status-not-matched/10',           textClass: 'text-status-not-matched',           borderClass: 'border-status-not-matched' },
  matched:                 { label: 'Matched',                        color: 'hsl(var(--status-matched))',           bgClass: 'bg-status-matched/10',               textClass: 'text-status-matched',               borderClass: 'border-status-matched' },
  ready_to_place:          { label: 'Ready to Place',                 color: 'hsl(var(--status-ready-to-place))',    bgClass: 'bg-status-ready-to-place/10',        textClass: 'text-status-ready-to-place',        borderClass: 'border-status-ready-to-place' },
  assigned:                { label: 'Assigned',                       color: 'hsl(var(--status-assigned))',          bgClass: 'bg-status-assigned/10',              textClass: 'text-status-assigned',              borderClass: 'border-status-assigned' },
  in_progress_you:         { label: 'Upcoming Appointment',           color: 'hsl(var(--status-in-progress))',       bgClass: 'bg-status-in-progress/10',           textClass: 'text-status-in-progress',           borderClass: 'border-status-in-progress' },
  intake_issue:            { label: 'Intake Issue',                   color: 'hsl(var(--status-issue))',             bgClass: 'bg-status-issue/10',                 textClass: 'text-status-issue',                 borderClass: 'border-status-issue' },
  selected_different_partner: { label: 'Selected with Different Partner', color: 'hsl(var(--status-selected-partner))',  bgClass: 'bg-status-selected-partner/10',      textClass: 'text-status-selected-partner',      borderClass: 'border-status-selected-partner' },
  removed:                 { label: 'Removed',                        color: 'hsl(var(--status-removed))',           bgClass: 'bg-status-removed/10',               textClass: 'text-status-removed',               borderClass: 'border-status-removed' },
};

export interface Intern {
  id: string;
  timestamp: string;
  emailSubmission: string;
  firstName: string;
  lastName: string;
  phone: string;
  parentPhone: string;
  dob: string;
  studentEmail: string;
  school: string;
  otherSchool: string;
  grade: string;
  gender: string;
  programs: string[];
  itInterests: string[];
  clevelandClinic: string;
  constructionMgmt: string;
  biomedical: string;
  envJustice: string;
  envClimate: string;
  envFieldScience: string;
  iersCenter: string;
  magnetManufacturing: string;
  educationInternship: string;
  healthcare: string;
  videoGames: string;
  csCourseTaken: string;
  specificInterests: string;
  additionalQuestions: string;
  isDuplicate: boolean;
  duplicateOf?: string;
  isNewest: boolean;
  adminNotes: string;
  status: InternStatus;
  intakeDate: string;
  intakeTime: string;
  intakeLocation: string;
  raceEthnicity: string;
  parentGuardianEmail: string;
  parentGuardianPhone: string;
  isEll: boolean;
  isCmsd: boolean;
}

export interface Worksite {
  id: string;
  name: string;
  category: string;
  description: string;
  capacity: number;
  filled: number;
  contactName: string;
  contactEmail: string;
  location: string;
  tags: string[];
  status?: WorksiteStatus;
  labels?: WorksiteLabel[];
}

export const WORKSITE_STATUSES = ['open', 'full', 'paused', 'closed'] as const;
export type WorksiteStatus = typeof WORKSITE_STATUSES[number];

export const WORKSITE_STATUS_CONFIG: Record<WorksiteStatus, { label: string; className: string }> = {
  open:   { label: 'Open',   className: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-400' },
  full:   { label: 'Full',   className: 'bg-rose-500/15 text-rose-700 border-rose-500/30 dark:text-rose-400' },
  paused: { label: 'Paused', className: 'bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400' },
  closed: { label: 'Closed', className: 'bg-slate-500/15 text-slate-700 border-slate-500/30 dark:text-slate-400' },
};

export interface WorksiteLabel {
  text: string;
  color: WorksiteLabelColor;
}

export const WORKSITE_LABEL_COLORS = ['blue','green','amber','red','purple','pink','teal','gray'] as const;
export type WorksiteLabelColor = typeof WORKSITE_LABEL_COLORS[number];

export const WORKSITE_LABEL_COLOR_CLASSES: Record<WorksiteLabelColor, string> = {
  blue:   'bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-400',
  green:  'bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-400',
  amber:  'bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400',
  red:    'bg-rose-500/15 text-rose-700 border-rose-500/30 dark:text-rose-400',
  purple: 'bg-violet-500/15 text-violet-700 border-violet-500/30 dark:text-violet-400',
  pink:   'bg-pink-500/15 text-pink-700 border-pink-500/30 dark:text-pink-400',
  teal:   'bg-teal-500/15 text-teal-700 border-teal-500/30 dark:text-teal-400',
  gray:   'bg-slate-500/15 text-slate-700 border-slate-500/30 dark:text-slate-400',
};

export type SchoolContactRole = 'principal' | 'guidance_counselor' | '5c';

export const CONTACT_ROLE_LABELS: Record<SchoolContactRole, string> = {
  principal: 'Principal',
  guidance_counselor: 'Guidance Counselor',
  '5c': '5C Career Counselor',
};

export interface SchoolContact {
  id: string;
  schoolName: string;
  role: SchoolContactRole;
  contactName: string;
  contactEmail: string;
}

export interface Placement {
  priority: 1 | 2 | 3;
  worksiteId: string;
  worksiteName: string;
  category: string;
  reasoning: string;
}

export interface Assignment {
  id: string;
  internId: string;
  worksiteId: string;
  createdAt: string;
}

export type InterestField = 
  | 'constructionMgmt'
  | 'biomedical'
  | 'envJustice'
  | 'envClimate'
  | 'envFieldScience'
  | 'magnetManufacturing'
  | 'educationInternship'
  | 'healthcare'
  | 'videoGames'
  | 'music'
  | 'art'
  | 'business'
  | 'law'
  | 'sports'
  | 'culinary';

// Fields that correspond to actual DB columns on the intern record
export const INTERN_INTEREST_FIELDS: Set<string> = new Set([
  'constructionMgmt', 'biomedical', 'envJustice', 'envClimate', 'envFieldScience',
  'magnetManufacturing', 'educationInternship', 'healthcare', 'videoGames',
]);

export const INTEREST_LABELS: Record<InterestField, string> = {
  healthcare: 'Healthcare',
  constructionMgmt: 'Construction Management',
  biomedical: 'Biomedical Science & Engineering',
  magnetManufacturing: 'Engineering',
  envJustice: 'Environmental Justice',
  envClimate: 'Climate Adaptation & Resilience',
  envFieldScience: 'Field Science & Data Analytics',
  educationInternship: 'Education / STEM Teaching',
  videoGames: 'Video Game / App Design',
  music: 'Music',
  art: 'Art & Creative',
  business: 'Business',
  law: 'Law & Legal',
  sports: 'Sports & Fitness',
  culinary: 'Culinary / Food',
};

export const WORKSITE_CATEGORIES = [
  'Healthcare',
  'Technology / IT',
  'Engineering',
  'Environmental Science',
  'Education',
  'Manufacturing',
  'Construction',
  'Research',
  'Design / Creative',
  'Business / Management',
  'Other',
];

export const DEFAULT_WORKSITES: Worksite[] = [
  {
    id: 'ws-1',
    name: 'Cleveland Clinic',
    category: 'Healthcare',
    description: 'Including Cleveland Clinic & IBM Partnership "Discovery Accelerator"',
    capacity: 10,
    filled: 0,
    contactName: '',
    contactEmail: '',
    location: 'Cleveland, OH',
    tags: ['healthcare', 'technology', 'IBM', 'research'],
  },
  {
    id: 'ws-2',
    name: 'Construction Management Program',
    category: 'Construction',
    description: 'Internship in Construction Management',
    capacity: 8,
    filled: 0,
    contactName: '',
    contactEmail: '',
    location: 'Cleveland, OH',
    tags: ['construction', 'management', 'hands-on'],
  },
  {
    id: 'ws-3',
    name: 'Biomedical Science & Engineering Lab',
    category: 'Engineering',
    description: 'Internship in Biomedical Science and Engineering',
    capacity: 6,
    filled: 0,
    contactName: '',
    contactEmail: '',
    location: 'Cleveland, OH',
    tags: ['biomedical', 'science', 'engineering', 'research'],
  },
  {
    id: 'ws-4',
    name: 'Environmental Justice Initiative',
    category: 'Environmental Science',
    description: 'Environmental Sustainability: Environmental Justice',
    capacity: 8,
    filled: 0,
    contactName: '',
    contactEmail: '',
    location: 'Cleveland, OH',
    tags: ['environment', 'justice', 'sustainability'],
  },
  {
    id: 'ws-5',
    name: 'Climate Adaptation & Resilience Program',
    category: 'Environmental Science',
    description: 'Environmental Sustainability: Climate Adaptation and Resilience',
    capacity: 6,
    filled: 0,
    contactName: '',
    contactEmail: '',
    location: 'Cleveland, OH',
    tags: ['climate', 'environment', 'sustainability', 'resilience'],
  },
  {
    id: 'ws-6',
    name: 'Field Science & Data Analytics',
    category: 'Environmental Science',
    description: 'Environmental Sustainability: Field Science and Data Analytics',
    capacity: 6,
    filled: 0,
    contactName: '',
    contactEmail: '',
    location: 'Cleveland, OH',
    tags: ['field-science', 'data', 'analytics', 'environment'],
  },
  {
    id: 'ws-7',
    name: 'CSU IERS Center',
    category: 'Research',
    description: "Cleveland State University's Center for Integrated Modeling for Energy, Resiliency and Sustainability",
    capacity: 6,
    filled: 0,
    contactName: '',
    contactEmail: '',
    location: 'Cleveland State University',
    tags: ['energy', 'sustainability', 'research', 'university'],
  },
  {
    id: 'ws-8',
    name: "MAGNET Summer Manufacturing Academy",
    category: 'Manufacturing',
    description: "MAGNET's Summer Manufacturing Academy",
    capacity: 10,
    filled: 0,
    contactName: '',
    contactEmail: '',
    location: 'Cleveland, OH',
    tags: ['manufacturing', 'hands-on', 'academy'],
  },
  {
    id: 'ws-9',
    name: 'STEM Education Internship',
    category: 'Education',
    description: 'Teaching kids about STEM subjects or providing mentorship as a camp counselor',
    capacity: 12,
    filled: 0,
    contactName: '',
    contactEmail: '',
    location: 'Cleveland, OH',
    tags: ['education', 'teaching', 'STEM', 'mentorship', 'camp'],
  },
  {
    id: 'ws-10',
    name: 'Healthcare Careers Program',
    category: 'Healthcare',
    description: 'Internship in healthcare-related career fields',
    capacity: 8,
    filled: 0,
    contactName: '',
    contactEmail: '',
    location: 'Cleveland, OH',
    tags: ['healthcare', 'medical', 'nursing'],
  },
  {
    id: 'ws-11',
    name: 'Game & App Design Studio',
    category: 'Design / Creative',
    description: 'Designing video games or other applications for different audiences',
    capacity: 8,
    filled: 0,
    contactName: '',
    contactEmail: '',
    location: 'Cleveland, OH',
    tags: ['games', 'design', 'apps', 'creative', 'technology'],
  },
];
