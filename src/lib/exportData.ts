import type { Intern, Worksite, Assignment } from '@/types/intern';

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
