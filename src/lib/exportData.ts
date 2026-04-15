import * as XLSX from 'xlsx';
import type { Intern, Worksite, Assignment, SchoolContact, InternStatus } from '@/types/intern';
import { STATUS_CONFIG, CONTACT_ROLE_LABELS, INTEREST_LABELS, type InterestField } from '@/types/intern';
import { normalizeSchoolName } from '@/lib/schoolNameNormalizer';
import { isEligibleForPreApprenticeship } from '@/lib/preApprenticeship';

interface PotentialMatch {
  uploadedName: string;
  uploadedFirstName: string;
  uploadedLastName: string;
  internId: string;
  internName: string;
  similarity: number;
  approved?: boolean;
}

export function exportRosterCSV(
  interns: Intern[],
  worksites: Worksite[],
  assignments: Assignment[]
) {
  const wsMap = Object.fromEntries(worksites.map(w => [w.id, w.name]));
  const assignMap = Object.fromEntries(assignments.map(a => [a.internId, a.worksiteId]));

  const headers = [
    'First Name', 'Last Name', 'Email', 'Phone', 'Parent Phone',
    'DOB', 'School', 'Grade', 'Programs', 'IT Interests',
    'Assigned Worksite', 'Admin Notes',
  ];

  const rows = interns.map(i => [
    i.firstName, i.lastName, i.studentEmail || i.emailSubmission, i.phone, i.parentPhone,
    i.dob, i.otherSchool || i.school, i.grade, i.programs.join('; '), i.itInterests.join('; '),
    assignMap[i.id] ? wsMap[assignMap[i.id]] || '' : 'Unassigned',
    i.adminNotes,
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `intern-roster-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportWorksiteCSV(
  worksites: Worksite[],
  assignments: Assignment[],
  interns: Intern[]
) {
  const counts: Record<string, number> = {};
  assignments.forEach(a => { counts[a.worksiteId] = (counts[a.worksiteId] || 0) + 1; });

  const internMap = Object.fromEntries(interns.map(i => [i.id, i]));
  const wsAssignments: Record<string, string[]> = {};
  assignments.forEach(a => {
    const intern = internMap[a.internId];
    if (intern) {
      if (!wsAssignments[a.worksiteId]) wsAssignments[a.worksiteId] = [];
      wsAssignments[a.worksiteId].push(`${intern.firstName} ${intern.lastName}`);
    }
  });

  const headers = ['Name', 'Category', 'Location', 'Capacity', 'Filled', 'Available', 'Assigned Interns'];
  const rows = worksites.map(w => {
    const filled = counts[w.id] || 0;
    return [w.name, w.category, w.location, String(w.capacity), String(filled), String(w.capacity - filled), (wsAssignments[w.id] || []).join('; ')];
  });

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `worksite-report-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportMatchReviewCSV(
  potentialMatches: PotentialMatch[],
  exactMatches: number,
  noMatches: string[],
  targetStatus: string
) {
  const timestamp = new Date().toISOString().slice(0, 19).replace('T', '_');
  
  // Summary data
  const summary = [
    ['Match Review Summary', ''],
    ['Timestamp', new Date().toLocaleString()],
    ['Target Status', targetStatus],
    ['Exact Matches', String(exactMatches)],
    ['Potential Matches', String(potentialMatches.length)],
    ['No Matches Found', String(noMatches.length)],
    ['', ''],
  ];

  // Potential matches data
  const matchHeaders = [
    'Uploaded Name', 'Database Match', 'Similarity %', 'Decision', 'Status'
  ];
  
  const matchRows = potentialMatches.map(match => [
    match.uploadedName,
    match.internName,
    `${Math.round(match.similarity * 100)}%`,
    match.approved === true ? 'Approved' : match.approved === false ? 'Rejected' : 'Pending',
    match.approved === true ? `Will update to ${targetStatus}` : match.approved === false ? 'No change' : 'Awaiting decision'
  ]);

  // No matches data
  const noMatchSection = noMatches.length > 0 ? [
    ['', ''],
    ['Names with No Matches', ''],
    ...noMatches.map(name => [name, 'No close match found'])
  ] : [];

  // Combine all sections
  const allRows = [
    ...summary,
    matchHeaders,
    ...matchRows,
    ...noMatchSection
  ];

  const csvContent = allRows
    .map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `match-review-${timestamp}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportStatusContactCSV(
  interns: Intern[],
  schoolContacts: SchoolContact[],
  status: InternStatus
) {
  const filtered = interns.filter(i => i.isNewest && i.status === status);
  if (filtered.length === 0) return false;

  const contactsBySchool: Record<string, SchoolContact[]> = {};
  schoolContacts.forEach(c => {
    const key = normalizeSchoolName(c.schoolName);
    if (!contactsBySchool[key]) contactsBySchool[key] = [];
    contactsBySchool[key].push(c);
  });

  // Group interns by school
  const bySchool: Record<string, { displayName: string; interns: Intern[] }> = {};
  filtered.forEach(i => {
    const schoolDisplay = i.otherSchool || i.school || 'Unknown School';
    const key = normalizeSchoolName(schoolDisplay);
    if (!bySchool[key]) bySchool[key] = { displayName: schoolDisplay, interns: [] };
    bySchool[key].interns.push(i);
  });

  const allRows: string[][] = [];
  const schoolKeys = Object.keys(bySchool).sort();

  schoolKeys.forEach((key, idx) => {
    const group = bySchool[key];
    const contacts = contactsBySchool[key] || [];
    const byRole = (role: string) => contacts.filter(c => c.role === role);
    const principals = byRole('principal');
    const guidances = byRole('guidance_counselor');
    const fiveCs = byRole('5c');

    // School header block
    allRows.push([`SCHOOL: ${group.displayName}`, '', '', `Students: ${group.interns.length}`]);
    principals.forEach(p => allRows.push(['', 'Principal:', p.contactName, p.contactEmail]));
    guidances.forEach(g => allRows.push(['', 'Guidance Counselor:', g.contactName, g.contactEmail]));
    fiveCs.forEach(f => allRows.push(['', '5C Career Counselor:', f.contactName, f.contactEmail]));
    if (!principals.length && !guidances.length && !fiveCs.length) allRows.push(['', 'No school contacts on file', '', '']);

    // Column headers for students — include appointment info for in_progress
    const hasAppointments = status === 'in_progress_you';
    if (hasAppointments) {
      allRows.push(['First Name', 'Last Name', 'Student Email', 'Phone', 'Parent Phone', 'Grade', 'PreApp Eligible', 'Appt Date', 'Appt Time', 'Appt Location']);
    } else {
      allRows.push(['First Name', 'Last Name', 'Student Email', 'Phone', 'Parent Phone', 'Grade', 'PreApp Eligible']);
    }

    // Student rows sorted by last name
    group.interns
      .sort((a, b) => a.lastName.localeCompare(b.lastName))
      .forEach(i => {
        const baseRow = [
          i.firstName, i.lastName, i.studentEmail || i.emailSubmission,
          i.phone, i.parentPhone, i.grade,
          isEligibleForPreApprenticeship(i.dob) ? 'Yes' : 'No',
        ];
        if (hasAppointments) {
          baseRow.push(i.intakeDate || '', i.intakeTime || '', i.intakeLocation || '');
        }
        allRows.push(baseRow);
      });

    // Blank separator between schools
    if (idx < schoolKeys.length - 1) {
      allRows.push([]);
    }
  });

  const csvContent = allRows
    .map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${status}-by-school-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  return true;
}

/**
 * Export email-ready text file: one pre-formatted email block per school contact,
 * with student list ready to copy-paste into an email.
 */
export function exportEmailReadyByStatus(
  interns: Intern[],
  schoolContacts: SchoolContact[],
  status: InternStatus
) {
  const statusLabel = STATUS_CONFIG[status].label;
  const filtered = interns.filter(i => i.isNewest && i.status === status);
  if (filtered.length === 0) return false;

  const contactsBySchool: Record<string, SchoolContact[]> = {};
  schoolContacts.forEach(c => {
    const key = normalizeSchoolName(c.schoolName);
    if (!contactsBySchool[key]) contactsBySchool[key] = [];
    contactsBySchool[key].push(c);
  });

  const bySchool: Record<string, { displayName: string; interns: Intern[] }> = {};
  filtered.forEach(i => {
    const schoolDisplay = i.otherSchool || i.school || 'Unknown School';
    const key = normalizeSchoolName(schoolDisplay);
    if (!bySchool[key]) bySchool[key] = { displayName: schoolDisplay, interns: [] };
    bySchool[key].interns.push(i);
  });

  const blocks: string[] = [];
  const schoolKeys = Object.keys(bySchool).sort();

  schoolKeys.forEach(key => {
    const group = bySchool[key];
    const contacts = contactsBySchool[key] || [];
    const allEmails = contacts.map(c => c.contactEmail).filter(Boolean);

    // Build student list
    const studentLines = group.interns
      .sort((a, b) => a.lastName.localeCompare(b.lastName))
      .map((i, idx) => {
        const email = i.studentEmail || i.emailSubmission || '';
        const phone = i.phone || '';
        const grade = i.grade || '';
        let line = `  ${idx + 1}. ${i.firstName} ${i.lastName} — Email: ${email}, Phone: ${phone}, Grade: ${grade}`;
        if (isEligibleForPreApprenticeship(i.dob)) {
          line += ` ⭐ PreApp Eligible`;
        }
        if (status === 'in_progress_you' && (i.intakeDate || i.intakeTime || i.intakeLocation)) {
          const parts = [i.intakeDate, i.intakeTime, i.intakeLocation].filter(Boolean);
          line += `\n     📅 Appointment: ${parts.join(' | ')}`;
        }
        return line;
      });

    const contactLines = contacts.map(c => {
      const roleLabel = c.role === 'principal' ? 'Principal' : c.role === 'guidance_counselor' ? 'Guidance Counselor' : c.role === '5c' ? '5C Career Counselor' : c.role;
      return `  ${roleLabel}: ${c.contactName} <${c.contactEmail}>`;
    });

    let block = '';
    block += `═══════════════════════════════════════════════════\n`;
    block += `SCHOOL: ${group.displayName}\n`;
    block += `TO: ${allEmails.length > 0 ? allEmails.join('; ') : '(no contacts on file)'}\n`;
    block += `═══════════════════════════════════════════════════\n\n`;

    if (contactLines.length > 0) {
      block += `School Contacts:\n${contactLines.join('\n')}\n\n`;
    }

    if (status === 'in_progress_you') {
      block += `The following ${group.interns.length} student(s) from ${group.displayName} have been accepted into our internship program, and have an upcoming intake appointment as seen below. You are receiving this email because often there are technical barriers that cause a student to miss the email, or have it blocked by their email provider, and more.\n\n`;
      block += studentLines.join('\n');
      block += '\n\nThank you for continuing to help us break barriers for our students.\n';
    } else {
      block += `The following ${group.interns.length} student(s) from ${group.displayName} have status "${statusLabel}":\n\n`;
      block += studentLines.join('\n');
      block += '\n';
    }

    blocks.push(block);
  });

  const header = `EXPLR Internships — ${statusLabel} Students by School\nGenerated: ${new Date().toLocaleString()}\nTotal Students: ${filtered.length} across ${schoolKeys.length} school(s)\n\n`;
  const content = header + blocks.join('\n\n');

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `email-${status}-by-school-${new Date().toISOString().slice(0, 10)}.txt`;
  link.click();
  URL.revokeObjectURL(url);
  return true;
}

const INTEREST_FIELDS: InterestField[] = [
  'constructionMgmt', 'biomedical', 'envJustice',
  'envClimate', 'envFieldScience', 'magnetManufacturing',
  'educationInternship', 'healthcare', 'videoGames',
];

function internToRow(
  intern: Intern,
  worksites: Worksite[],
  assignments: Assignment[],
  schoolContacts: SchoolContact[],
) {
  const wsMap = Object.fromEntries(worksites.map(w => [w.id, w]));
  const assignment = assignments.find(a => a.internId === intern.id);
  const assignedWs = assignment ? wsMap[assignment.worksiteId] : null;
  const school = intern.otherSchool || intern.school || '';
  const normalizedSchool = normalizeSchoolName(school);
  const contacts = schoolContacts.filter(c => normalizeSchoolName(c.schoolName) === normalizedSchool);
  const principals = contacts.filter(c => c.role === 'principal');
  const guidances = contacts.filter(c => c.role === 'guidance_counselor');
  const fiveCs = contacts.filter(c => c.role === '5c');

  const row: Record<string, string> = {
    'Status': STATUS_CONFIG[intern.status]?.label || intern.status,
    'First Name': intern.firstName,
    'Last Name': intern.lastName,
    'Email': intern.studentEmail || intern.emailSubmission,
    'Phone': intern.phone,
    'Parent Phone': intern.parentPhone,
    'Parent/Guardian Phone': intern.parentGuardianPhone || '',
    'Parent/Guardian Email': intern.parentGuardianEmail || '',
    'DOB': intern.dob,
    'School': school,
    'Grade': intern.grade,
    'Gender': intern.gender || '',
    'Race/Ethnicity': intern.raceEthnicity || '',
    'ELL': intern.isEll ? 'Yes' : 'No',
    'Eligible for PreApprenticeship': isEligibleForPreApprenticeship(intern.dob) ? 'Yes' : 'No',
    'Programs': intern.programs.join('; '),
    'IT Interests': intern.itInterests.join('; '),
    'Intake Date': intern.intakeDate,
    'Intake Time': intern.intakeTime,
    'Intake Location': intern.intakeLocation,
    'Assigned Worksite': assignedWs?.name || '',
    'Worksite Category': assignedWs?.category || '',
    'Admin Notes': intern.adminNotes,
    'CS/IT Course': intern.csCourseTaken,
    'Specific Interests': intern.specificInterests,
    'Additional Questions': intern.additionalQuestions,
    'Principal(s)': principals.map(p => `${p.contactName} <${p.contactEmail}>`).join('; ') || '',
    'Guidance Counselor(s)': guidances.map(g => `${g.contactName} <${g.contactEmail}>`).join('; ') || '',
    '5C Counselor(s)': fiveCs.map(f => `${f.contactName} <${f.contactEmail}>`).join('; ') || '',
  };

  for (const field of INTEREST_FIELDS) {
    row[INTEREST_LABELS[field]] = intern[field];
  }

  return row;
}

export function exportFullExcelByStatus(
  interns: Intern[],
  worksites: Worksite[],
  assignments: Assignment[],
  schoolContacts: SchoolContact[],
) {
  const active = interns.filter(i => i.isNewest);
  const wb = XLSX.utils.book_new();

  // "All Students" sheet
  const allRows = active
    .sort((a, b) => a.lastName.localeCompare(b.lastName))
    .map(i => internToRow(i, worksites, assignments, schoolContacts));
  if (allRows.length > 0) {
    const ws = XLSX.utils.json_to_sheet(allRows);
    XLSX.utils.book_append_sheet(wb, ws, 'All Students');
  }

  // One sheet per status that has students
  for (const status of Object.keys(STATUS_CONFIG) as InternStatus[]) {
    const filtered = active.filter(i => i.status === status);
    if (filtered.length === 0) continue;
    const rows = filtered
      .sort((a, b) => a.lastName.localeCompare(b.lastName))
      .map(i => internToRow(i, worksites, assignments, schoolContacts));
    const ws = XLSX.utils.json_to_sheet(rows);
    const label = STATUS_CONFIG[status].label.substring(0, 31); // Excel 31-char sheet name limit
    XLSX.utils.book_append_sheet(wb, ws, label);
  }

  XLSX.writeFile(wb, `intern-roster-full-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
