import type { Intern, Worksite, Assignment, SchoolContact, InternStatus } from '@/types/intern';
import { STATUS_CONFIG, CONTACT_ROLE_LABELS } from '@/types/intern';

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
    const key = c.schoolName.toLowerCase().trim();
    if (!contactsBySchool[key]) contactsBySchool[key] = [];
    contactsBySchool[key].push(c);
  });

  // Group interns by school
  const bySchool: Record<string, { displayName: string; interns: Intern[] }> = {};
  filtered.forEach(i => {
    const schoolDisplay = i.otherSchool || i.school || 'Unknown School';
    const key = schoolDisplay.toLowerCase().trim();
    if (!bySchool[key]) bySchool[key] = { displayName: schoolDisplay, interns: [] };
    bySchool[key].interns.push(i);
  });

  const allRows: string[][] = [];
  const schoolKeys = Object.keys(bySchool).sort();

  schoolKeys.forEach((key, idx) => {
    const group = bySchool[key];
    const contacts = contactsBySchool[key] || [];
    const byRole = (role: string) => contacts.find(c => c.role === role);
    const principal = byRole('principal');
    const guidance = byRole('guidance_counselor');
    const fiveC = byRole('5c');

    // School header block
    allRows.push([`SCHOOL: ${group.displayName}`, '', '', `Students: ${group.interns.length}`]);
    if (principal) allRows.push(['', 'Principal:', principal.contactName, principal.contactEmail]);
    if (guidance) allRows.push(['', 'Guidance Counselor:', guidance.contactName, guidance.contactEmail]);
    if (fiveC) allRows.push(['', '5C Career Counselor:', fiveC.contactName, fiveC.contactEmail]);
    if (!principal && !guidance && !fiveC) allRows.push(['', 'No school contacts on file', '', '']);

    // Column headers for students
    allRows.push(['First Name', 'Last Name', 'Student Email', 'Phone', 'Parent Phone', 'Grade']);

    // Student rows sorted by last name
    group.interns
      .sort((a, b) => a.lastName.localeCompare(b.lastName))
      .forEach(i => {
        allRows.push([
          i.firstName, i.lastName, i.studentEmail || i.emailSubmission,
          i.phone, i.parentPhone, i.grade,
        ]);
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
    const key = c.schoolName.toLowerCase().trim();
    if (!contactsBySchool[key]) contactsBySchool[key] = [];
    contactsBySchool[key].push(c);
  });

  const bySchool: Record<string, { displayName: string; interns: Intern[] }> = {};
  filtered.forEach(i => {
    const schoolDisplay = i.otherSchool || i.school || 'Unknown School';
    const key = schoolDisplay.toLowerCase().trim();
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
        return `  ${idx + 1}. ${i.firstName} ${i.lastName} — Email: ${email}, Phone: ${phone}, Grade: ${grade}`;
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

    block += `The following ${group.interns.length} student(s) from ${group.displayName} have status "${statusLabel}":\n\n`;
    block += studentLines.join('\n');
    block += '\n';

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
