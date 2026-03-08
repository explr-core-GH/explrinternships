import * as XLSX from 'xlsx';
import type { Intern } from '@/types/intern';

const COL_MAP: Record<string, keyof Intern> = {
  'Timestamp': 'timestamp',
  'First Name': 'firstName',
  'Last Name': 'lastName',
  'What is your phone number?': 'phone',
  "What is your parent/guardian's phone number?": 'parentPhone',
  'Date of Birth': 'dob',
  'Which CMSD school do you attend?': 'school',
  'What grade are you currently enrolled in?': 'grade',
  'Would you be interested in working for the Cleveland Clinic': 'clevelandClinic',
  'Would you be interested in an internship in Construction Management?': 'constructionMgmt',
  'Would you be interested in an internship in Biomedical Science and Engineering?': 'biomedical',
  'Would you be interested in an internship in Environmental Sustainability: Environmental Justice?': 'envJustice',
  'Would you be interested in an internship in Environmental Sustainability: Climate Adaptation and Resilience?': 'envClimate',
  'Would you be interested in an internship in Environmental Sustainability: Field Science and Data Analytics?': 'envFieldScience',
  "Are you interested in an internship with Cleveland State University's IERS Center": 'iersCenter',
  "Are you interested in an internship with MAGNET's Summer Manufacturing Academy?": 'magnetManufacturing',
  'Are you interested in an education-oriented internship': 'educationInternship',
  'Are you interested in an internship in healthcare-related career fields?': 'healthcare',
  'Are you interested in an internship where you would be designing video games': 'videoGames',
  'Have you ever taken a Computer Science or IT course?': 'csCourseTaken',
  "Do you have specific interests that weren't listed above?": 'specificInterests',
  'What additional questions do you have?': 'additionalQuestions',
};

function findColumn(headers: string[], search: string): number {
  return headers.findIndex(h => h && h.toLowerCase().includes(search.toLowerCase()));
}

function getVal(row: any[], headers: string[], search: string): string {
  const idx = findColumn(headers, search);
  return idx >= 0 ? String(row[idx] ?? '').trim() : '';
}

export function parseExcelFile(data: ArrayBuffer): Intern[] {
  const workbook = XLSX.read(data, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  if (rows.length < 2) return [];
  
  const headers = rows[0].map((h: any) => String(h ?? ''));
  
  const emailIdx1 = 1; // "Email Address" (submission)
  const emailIdx2 = findColumn(headers, 'student\'s email') >= 0 
    ? findColumn(headers, 'student\'s email')
    : findColumn(headers, 'This should be the student');

  const interns: Intern[] = [];
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 3) continue;
    
    const firstName = getVal(row, headers, 'First Name');
    const lastName = getVal(row, headers, 'Last Name');
    if (!firstName && !lastName) continue;

    const programsStr = getVal(row, headers, 'Have you participated in any of the following');
    const itStr = getVal(row, headers, 'What areas of IT Interest');
    const otherSchoolStr = getVal(row, headers, 'If you do not attend a CMSD');
    
    const intern: Intern = {
      id: `intern-${i}-${Date.now()}`,
      timestamp: getVal(row, headers, 'Timestamp'),
      emailSubmission: String(row[emailIdx1] ?? '').trim(),
      firstName,
      lastName,
      phone: getVal(row, headers, 'What is your phone number'),
      parentPhone: getVal(row, headers, "parent/guardian's phone"),
      dob: getVal(row, headers, 'Date of Birth'),
      studentEmail: emailIdx2 >= 0 ? String(row[emailIdx2] ?? '').trim() : '',
      school: getVal(row, headers, 'Which CMSD school'),
      otherSchool: otherSchoolStr,
      grade: getVal(row, headers, 'What grade are you currently'),
      programs: programsStr ? programsStr.split(',').map(s => s.trim()).filter(Boolean) : [],
      itInterests: itStr ? itStr.split(',').map(s => s.trim()).filter(Boolean) : [],
      clevelandClinic: getVal(row, headers, 'Cleveland Clinic'),
      constructionMgmt: getVal(row, headers, 'Construction Management'),
      biomedical: getVal(row, headers, 'Biomedical Science'),
      envJustice: getVal(row, headers, 'Environmental Justice'),
      envClimate: getVal(row, headers, 'Climate Adaptation'),
      envFieldScience: getVal(row, headers, 'Field Science'),
      iersCenter: getVal(row, headers, 'IERS Center'),
      magnetManufacturing: getVal(row, headers, "MAGNET"),
      educationInternship: getVal(row, headers, 'education-oriented'),
      healthcare: getVal(row, headers, 'healthcare-related'),
      videoGames: getVal(row, headers, 'designing video games'),
      csCourseTaken: getVal(row, headers, 'Computer Science or IT course'),
      specificInterests: getVal(row, headers, "specific interests that weren't"),
      additionalQuestions: getVal(row, headers, 'additional questions'),
      isDuplicate: false,
      isNewest: true,
      adminNotes: '',
      status: 'pending',
    };
    
    interns.push(intern);
  }
  
  return markDuplicates(interns);
}

function markDuplicates(interns: Intern[]): Intern[] {
  const groups = new Map<string, Intern[]>();
  
  for (const intern of interns) {
    const key = `${intern.firstName.toLowerCase()}_${intern.lastName.toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(intern);
  }
  
  for (const [, group] of groups) {
    if (group.length <= 1) continue;
    
    // Sort by timestamp descending (newest first)
    group.sort((a, b) => {
      const da = new Date(a.timestamp).getTime() || 0;
      const db = new Date(b.timestamp).getTime() || 0;
      return db - da;
    });
    
    // Newest is first, rest are older duplicates
    for (let i = 0; i < group.length; i++) {
      group[i].isDuplicate = true;
      group[i].isNewest = i === 0;
      if (i > 0) {
        group[i].duplicateOf = group[0].id;
      }
    }
  }
  
  return interns;
}
