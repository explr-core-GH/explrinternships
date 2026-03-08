export const INTERN_STATUSES = ['pending', 'matched', 'assigned', 'in_progress_you', 'intake_issue', 'removed'] as const;
export type InternStatus = typeof INTERN_STATUSES[number];

export const STATUS_CONFIG: Record<InternStatus, { label: string; color: string; bgClass: string; textClass: string; borderClass: string }> = {
  pending:         { label: 'Pending',            color: 'gray',    bgClass: 'bg-muted',              textClass: 'text-muted-foreground', borderClass: 'border-muted-foreground/30' },
  matched:         { label: 'Matched',            color: '#86efac', bgClass: 'bg-emerald-200/40',      textClass: 'text-emerald-700 dark:text-emerald-300', borderClass: 'border-emerald-300' },
  assigned:        { label: 'Assigned',           color: '#22c55e', bgClass: 'bg-green-500/20',        textClass: 'text-green-700 dark:text-green-300', borderClass: 'border-green-500' },
  in_progress_you: { label: 'In Progress (YOU)',  color: '#facc15', bgClass: 'bg-yellow-400/20',       textClass: 'text-yellow-700 dark:text-yellow-300', borderClass: 'border-yellow-400' },
  intake_issue:    { label: 'Intake Issue',       color: '#f97316', bgClass: 'bg-orange-400/20',       textClass: 'text-orange-700 dark:text-orange-300', borderClass: 'border-orange-400' },
  removed:         { label: 'Removed',            color: '#ef4444', bgClass: 'bg-red-500/20',          textClass: 'text-red-700 dark:text-red-300', borderClass: 'border-red-500' },
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
  | 'clevelandClinic'
  | 'constructionMgmt'
  | 'biomedical'
  | 'envJustice'
  | 'envClimate'
  | 'envFieldScience'
  | 'iersCenter'
  | 'magnetManufacturing'
  | 'educationInternship'
  | 'healthcare'
  | 'videoGames';

export const INTEREST_LABELS: Record<InterestField, string> = {
  clevelandClinic: 'Cleveland Clinic',
  constructionMgmt: 'Construction Management',
  biomedical: 'Biomedical Science & Engineering',
  envJustice: 'Environmental Justice',
  envClimate: 'Climate Adaptation & Resilience',
  envFieldScience: 'Field Science & Data Analytics',
  iersCenter: 'CSU IERS Center',
  magnetManufacturing: "MAGNET Manufacturing Academy",
  educationInternship: 'Education / STEM Teaching',
  healthcare: 'Healthcare',
  videoGames: 'Video Game / App Design',
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
