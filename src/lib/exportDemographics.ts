import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import type { Intern } from '@/types/intern';
import { INTEREST_LABELS, STATUS_CONFIG, type InterestField, type InternStatus } from '@/types/intern';

const INTEREST_FIELDS: InterestField[] = [
  'clevelandClinic', 'constructionMgmt', 'biomedical', 'envJustice',
  'envClimate', 'envFieldScience', 'iersCenter', 'magnetManufacturing',
  'educationInternship', 'healthcare', 'videoGames',
];

const GRADE_ORDER = ['8th', '9th', '10th', '11th', '12th'];

interface DemoStats {
  total: number;
  grades: Record<string, number>;
  schools: Record<string, number>;
  programs: Record<string, number>;
  genders: Record<string, number>;
  interestCounts: Record<string, { yes: number; maybe: number; no: number }>;
  itInterests: [string, number][];
  duplicates: number;
}

function computeStats(interns: Intern[]): DemoStats {
  const grades: Record<string, number> = {};
  const schools: Record<string, number> = {};
  const programs: Record<string, number> = {};
  const genders: Record<string, number> = {};
  const interestCounts: Record<string, { yes: number; maybe: number; no: number }> = {};
  const itCounts: Record<string, number> = {};

  for (const f of INTEREST_FIELDS) interestCounts[f] = { yes: 0, maybe: 0, no: 0 };

  for (const intern of interns) {
    grades[intern.grade] = (grades[intern.grade] || 0) + 1;
    const school = intern.otherSchool || intern.school;
    schools[school] = (schools[school] || 0) + 1;
    const g = intern.gender || 'Not Specified';
    genders[g] = (genders[g] || 0) + 1;
    for (const p of intern.programs) {
      if (p !== 'Not Applicable/None') programs[p] = (programs[p] || 0) + 1;
    }
    for (const f of INTEREST_FIELDS) {
      const v = intern[f];
      if (v === 'Yes') interestCounts[f].yes++;
      else if (v === 'Maybe') interestCounts[f].maybe++;
      else interestCounts[f].no++;
    }
    for (const it of intern.itInterests) {
      itCounts[it] = (itCounts[it] || 0) + 1;
    }
  }

  return {
    total: interns.length,
    grades,
    schools,
    genders,
    programs,
    interestCounts,
    itInterests: Object.entries(itCounts).sort((a, b) => b[1] - a[1]),
    duplicates: interns.filter(i => i.isDuplicate).length,
  };
}

function statusLabel(status: InternStatus | 'all'): string {
  return status === 'all' ? 'All Statuses' : STATUS_CONFIG[status].label;
}

function fileName(prefix: string, status: InternStatus | 'all', ext: string): string {
  const tag = status === 'all' ? 'all' : status;
  return `${prefix}-${tag}-${new Date().toISOString().slice(0, 10)}.${ext}`;
}

// ── Excel Export ──────────────────────────────────────────────

export function exportDemographicsExcel(interns: Intern[], status: InternStatus | 'all') {
  const filtered = interns.filter(i => i.isNewest && (status === 'all' || i.status === status));
  const stats = computeStats(filtered);
  const wb = XLSX.utils.book_new();
  const label = statusLabel(status);

  // Summary sheet
  const summaryRows = [
    ['EXPLR Internships — Demographics Report'],
    ['Status Filter', label],
    ['Generated', new Date().toLocaleString()],
    [],
    ['Metric', 'Value'],
    ['Total Interns', stats.total],
    ['Schools', Object.keys(stats.schools).length],
    ['Grade Levels', Object.keys(stats.grades).length],
    ['Duplicates', stats.duplicates],
  ];
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

  // Grades sheet
  const gradeRows = [['Grade', 'Count', 'Percentage']];
  const sortedGrades = GRADE_ORDER.filter(g => stats.grades[g]).map(g => ({ grade: g, count: stats.grades[g] }));
  const totalGrade = sortedGrades.reduce((s, g) => s + g.count, 0);
  sortedGrades.forEach(({ grade, count }) => {
    gradeRows.push([grade, String(count), `${Math.round((count / totalGrade) * 100)}%`]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(gradeRows), 'By Grade');

  // Schools sheet
  const schoolRows: (string | number)[][] = [['School', 'Count']];
  Object.entries(stats.schools).sort((a, b) => b[1] - a[1]).forEach(([s, c]) => schoolRows.push([s, c]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(schoolRows), 'By School');

  // Interest levels sheet
  const intRows: (string | number)[][] = [['Interest Area', 'Yes', 'Maybe', 'No', '% Yes']];
  INTEREST_FIELDS.forEach(f => {
    const { yes, maybe, no } = stats.interestCounts[f];
    const total = yes + maybe + no;
    intRows.push([INTEREST_LABELS[f], yes, maybe, no, total ? `${Math.round((yes / total) * 100)}%` : '0%']);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(intRows), 'Interest Levels');

  // IT Interests sheet
  const itRows: (string | number)[][] = [['IT Interest', 'Count']];
  stats.itInterests.slice(0, 30).forEach(([name, count]) => itRows.push([name, count]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(itRows), 'IT Interests');

  // Programs sheet
  if (Object.keys(stats.programs).length > 0) {
    const progRows: (string | number)[][] = [['Program', 'Count']];
    Object.entries(stats.programs).sort((a, b) => b[1] - a[1]).forEach(([p, c]) => progRows.push([p, c]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(progRows), 'Programs');
  }

  XLSX.writeFile(wb, fileName('demographics', status, 'xlsx'));
}

// ── PDF Export ────────────────────────────────────────────────

export function exportDemographicsPDF(interns: Intern[], status: InternStatus | 'all') {
  const filtered = interns.filter(i => i.isNewest && (status === 'all' || i.status === status));
  const stats = computeStats(filtered);
  const label = statusLabel(status);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = margin;

  const checkPage = (need: number) => {
    if (y + need > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const drawSectionHeader = (title: string) => {
    checkPage(14);
    y += 4;
    doc.setFillColor(22, 135, 120); // primary teal
    doc.roundedRect(margin, y, contentW, 8, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin + 3, y + 5.5);
    doc.setTextColor(30, 30, 30);
    y += 12;
  };

  const drawRow = (left: string, right: string, bold = false) => {
    checkPage(6);
    doc.setFontSize(9);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.text(left, margin + 2, y);
    doc.text(right, pageW - margin - 2, y, { align: 'right' });
    y += 5;
  };

  // Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 135, 120);
  doc.text('EXPLR Internships', margin, y + 2);
  y += 8;
  doc.setFontSize(12);
  doc.setTextColor(60, 60, 60);
  doc.text(`Demographics Report — ${label}`, margin, y);
  y += 6;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text(`Generated ${new Date().toLocaleString()} · ${stats.total} interns`, margin, y);
  y += 4;

  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageW - margin, y);
  y += 4;

  // Summary
  drawSectionHeader('Summary');
  drawRow('Total Interns', String(stats.total), true);
  drawRow('Schools', String(Object.keys(stats.schools).length));
  drawRow('Grade Levels', String(Object.keys(stats.grades).length));
  drawRow('Duplicates', String(stats.duplicates));

  // Grades
  const sortedGrades = GRADE_ORDER.filter(g => stats.grades[g]).map(g => ({ grade: g, count: stats.grades[g] }));
  const totalGrade = sortedGrades.reduce((s, g) => s + g.count, 0);
  drawSectionHeader('By Grade');
  sortedGrades.forEach(({ grade, count }) => {
    const pct = Math.round((count / totalGrade) * 100);
    // Draw bar
    checkPage(8);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(grade, margin + 2, y);
    const barX = margin + 20;
    const barW = contentW - 45;
    const fillW = barW * (pct / 100);
    doc.setFillColor(230, 230, 230);
    doc.roundedRect(barX, y - 3.5, barW, 4.5, 1, 1, 'F');
    doc.setFillColor(22, 135, 120);
    if (fillW > 1) doc.roundedRect(barX, y - 3.5, fillW, 4.5, 1, 1, 'F');
    doc.text(`${count} (${pct}%)`, pageW - margin - 2, y, { align: 'right' });
    y += 7;
  });

  // Schools
  const schoolEntries = Object.entries(stats.schools).sort((a, b) => b[1] - a[1]);
  drawSectionHeader(`By School (${schoolEntries.length})`);
  schoolEntries.forEach(([school, count]) => {
    drawRow(school.length > 50 ? school.substring(0, 47) + '...' : school, String(count));
  });

  // Interest Levels
  drawSectionHeader('Internship Interest Levels');
  INTEREST_FIELDS.forEach(f => {
    const { yes, maybe, no } = stats.interestCounts[f];
    const total = yes + maybe + no;
    checkPage(8);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const labelText = INTEREST_LABELS[f];
    doc.text(labelText.length > 35 ? labelText.substring(0, 32) + '...' : labelText, margin + 2, y);

    const barX = margin + 62;
    const barW = contentW - 90;
    const yesPct = total ? (yes / total) : 0;
    const maybePct = total ? (maybe / total) : 0;

    doc.setFillColor(230, 230, 230);
    doc.roundedRect(barX, y - 3.5, barW, 4.5, 1, 1, 'F');
    if (yesPct > 0) {
      doc.setFillColor(34, 197, 94); // green
      doc.rect(barX, y - 3.5, barW * yesPct, 4.5, 'F');
    }
    if (maybePct > 0) {
      doc.setFillColor(234, 179, 8); // amber
      doc.rect(barX + barW * yesPct, y - 3.5, barW * maybePct, 4.5, 'F');
    }

    doc.setFontSize(7);
    doc.text(`${yes}Y  ${maybe}M  ${no}N`, pageW - margin - 2, y, { align: 'right' });
    y += 7;
  });

  // IT Interests
  if (stats.itInterests.length > 0) {
    drawSectionHeader('Top IT Interests');
    stats.itInterests.slice(0, 15).forEach(([interest, count]) => {
      drawRow(interest.length > 55 ? interest.substring(0, 52) + '...' : interest, String(count));
    });
  }

  // Programs
  const programEntries = Object.entries(stats.programs).sort((a, b) => b[1] - a[1]);
  if (programEntries.length > 0) {
    drawSectionHeader('Prior Program Participation');
    programEntries.forEach(([prog, count]) => {
      drawRow(prog.length > 55 ? prog.substring(0, 52) + '...' : prog, String(count));
    });
  }

  doc.save(fileName('demographics', status, 'pdf'));
}
