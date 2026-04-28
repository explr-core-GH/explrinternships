import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import type { Intern } from '@/types/intern';
import { INTEREST_LABELS, STATUS_CONFIG, type InterestField, type InternStatus } from '@/types/intern';
import { isEligibleForPreApprenticeship } from '@/lib/preApprenticeship';

// Collapse any "Summer Internship in 20XX" variant into a single bucket.
export function normalizeProgramLabel(p: string): string {
  const s = p.trim().toLowerCase();
  // Match any prior-year internship variant including comma-split fragments
  // like "I participated in a Summer Internship in 2023", "2024", "or 2025".
  const hasInternship = s.includes('internship');
  const hasYear = /20\d{2}/.test(s);
  const isYearFragment = /^(or\s+)?20\d{2}$/.test(s); // bare "2024" or "or 2025"
  if ((hasInternship && hasYear) || isYearFragment) {
    return 'Participated in Internships in a Previous Year';
  }
  return p;
}

const INTEREST_FIELDS: InterestField[] = [
  'constructionMgmt', 'biomedical', 'envJustice',
  'envClimate', 'envFieldScience', 'magnetManufacturing',
  'educationInternship', 'healthcare', 'videoGames',
];

const GRADE_ORDER = ['8th', '9th', '10th', '11th', '12th'];

interface DemoStats {
  total: number;
  grades: Record<string, number>;
  schools: Record<string, number>;
  programs: Record<string, number>;
  genders: Record<string, number>;
  races: Record<string, number>;
  interestCounts: Record<string, { yes: number; maybe: number; no: number }>;
  itInterests: [string, number][];
  duplicates: number;
  preAppCount: number;
  ellCount: number;
  cmsdCount: number;
}

function computeStats(interns: Intern[]): DemoStats {
  const grades: Record<string, number> = {};
  const schools: Record<string, number> = {};
  const programs: Record<string, number> = {};
  const genders: Record<string, number> = {};
  const races: Record<string, number> = {};
  const interestCounts: Record<string, { yes: number; maybe: number; no: number }> = {};
  const itCounts: Record<string, number> = {};

  for (const f of INTEREST_FIELDS) interestCounts[f] = { yes: 0, maybe: 0, no: 0 };

  for (const intern of interns) {
    grades[intern.grade] = (grades[intern.grade] || 0) + 1;
    const school = intern.otherSchool || intern.school;
    schools[school] = (schools[school] || 0) + 1;
    if (intern.gender) {
      genders[intern.gender] = (genders[intern.gender] || 0) + 1;
    }
    if (intern.raceEthnicity) {
      const raceParts = intern.raceEthnicity.includes(';') ? intern.raceEthnicity.split(';').map(r => r.trim()).filter(Boolean) : [intern.raceEthnicity];
      for (const rp of raceParts) {
        races[rp] = (races[rp] || 0) + 1;
      }
    }
    const seen = new Set<string>();
    for (const p of intern.programs) {
      if (p === 'Not Applicable/None') continue;
      const label = normalizeProgramLabel(p);
      if (seen.has(label)) continue;
      seen.add(label);
      programs[label] = (programs[label] || 0) + 1;
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

  const preAppCount = interns.filter(i => isEligibleForPreApprenticeship(i.dob)).length;
  const ellCount = interns.filter(i => i.isEll).length;
  const cmsdCount = interns.filter(i => i.isCmsd).length;

  return {
    total: interns.length,
    grades,
    schools,
    genders,
    races,
    programs,
    interestCounts,
    itInterests: Object.entries(itCounts).sort((a, b) => b[1] - a[1]),
    duplicates: interns.filter(i => i.isDuplicate).length,
    preAppCount,
    ellCount,
    cmsdCount,
  };
}

function statusLabel(status: InternStatus | 'all' | InternStatus[]): string {
  if (Array.isArray(status)) return status.map(s => STATUS_CONFIG[s].label).join(' + ');
  return status === 'all' ? 'All Statuses' : STATUS_CONFIG[status].label;
}

function fileName(prefix: string, status: InternStatus | 'all' | InternStatus[], ext: string, suffix?: string): string {
  const tag = Array.isArray(status) ? status.join('+') : (status === 'all' ? 'all' : status);
  const suf = suffix ? `-${suffix}` : '';
  return `${prefix}-${tag}${suf}-${new Date().toISOString().slice(0, 10)}.${ext}`;
}

function matchesStatus(s: InternStatus, filter: InternStatus | 'all' | InternStatus[]): boolean {
  if (filter === 'all') return true;
  if (Array.isArray(filter)) return filter.includes(s);
  return s === filter;
}

// ── Excel Export ──────────────────────────────────────────────

export function exportDemographicsExcel(interns: Intern[], status: InternStatus | 'all' | InternStatus[], cmsdOnly = false) {
  const filtered = interns.filter(i => i.isNewest && matchesStatus(i.status, status) && (!cmsdOnly || i.isCmsd));
  const stats = computeStats(filtered);
  const wb = XLSX.utils.book_new();
  const label = `${statusLabel(status)}${cmsdOnly ? ' · CMSD Only' : ''}`;

  // Summary sheet
  const summaryRows = [
    ['EXPLR Internships — Demographics Report'],
    ['Status Filter', label],
    ['Generated', new Date().toLocaleString()],
    [],
    ['Metric', 'Value'],
    ['Total Interns', stats.total],
    ['Grade Levels', Object.keys(stats.grades).length],
    ['Eligible for PreApprenticeship', stats.preAppCount],
    ['ELL Students', stats.ellCount],
    ['CMSD Students', stats.cmsdCount],
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

  // Gender sheet
  const genderRows: (string | number)[][] = [['Gender', 'Count', 'Percentage']];
  Object.entries(stats.genders).sort((a, b) => b[1] - a[1]).forEach(([g, c]) => {
    genderRows.push([g, c, `${Math.round((c / stats.total) * 100)}%`]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(genderRows), 'By Gender');

  // Race/Ethnicity sheet
  const raceRows: (string | number)[][] = [['Race / Ethnicity', 'Count', 'Percentage']];
  Object.entries(stats.races).sort((a, b) => b[1] - a[1]).forEach(([r, c]) => {
    raceRows.push([r, c, `${Math.round((c / stats.total) * 100)}%`]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(raceRows), 'By Race Ethnicity');

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

  XLSX.writeFile(wb, fileName('demographics', status, 'xlsx', cmsdOnly ? 'cmsd' : undefined));
}

// ── PDF Export ────────────────────────────────────────────────

export function exportDemographicsPDF(interns: Intern[], status: InternStatus | 'all', cmsdOnly = false) {
  const filtered = interns.filter(i => i.isNewest && (status === 'all' || i.status === status) && (!cmsdOnly || i.isCmsd));
  const stats = computeStats(filtered);
  const label = `${statusLabel(status)}${cmsdOnly ? ' · CMSD Only' : ''}`;

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
  drawRow('Grade Levels', String(Object.keys(stats.grades).length));
  drawRow('Eligible for PreApprenticeship', String(stats.preAppCount));
  drawRow('ELL Students', String(stats.ellCount));
  drawRow('CMSD Students', String(stats.cmsdCount));

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

  // Gender
  const genderEntries = Object.entries(stats.genders).sort((a, b) => b[1] - a[1]);
  drawSectionHeader('By Gender');
  genderEntries.forEach(([gender, count]) => {
    const pct = Math.round((count / stats.total) * 100);
    checkPage(8);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(gender, margin + 2, y);
    const barX = margin + 35;
    const barW = contentW - 60;
    const fillW = barW * (pct / 100);
    doc.setFillColor(230, 230, 230);
    doc.roundedRect(barX, y - 3.5, barW, 4.5, 1, 1, 'F');
    doc.setFillColor(22, 135, 120);
    if (fillW > 1) doc.roundedRect(barX, y - 3.5, fillW, 4.5, 1, 1, 'F');
    doc.text(`${count} (${pct}%)`, pageW - margin - 2, y, { align: 'right' });
    y += 7;
  });

  // Race/Ethnicity
  const raceEntries = Object.entries(stats.races).sort((a, b) => b[1] - a[1]);
  drawSectionHeader('By Race / Ethnicity');
  raceEntries.forEach(([race, count]) => {
    const pct = Math.round((count / stats.total) * 100);
    checkPage(8);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const raceLabel = race.length > 40 ? race.substring(0, 37) + '...' : race;
    doc.text(raceLabel, margin + 2, y);
    const barX = margin + 55;
    const barW = contentW - 80;
    const fillW = barW * (pct / 100);
    doc.setFillColor(230, 230, 230);
    doc.roundedRect(barX, y - 3.5, barW, 4.5, 1, 1, 'F');
    doc.setFillColor(22, 135, 120);
    if (fillW > 1) doc.roundedRect(barX, y - 3.5, fillW, 4.5, 1, 1, 'F');
    doc.text(`${count} (${pct}%)`, pageW - margin - 2, y, { align: 'right' });
    y += 7;
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

  doc.save(fileName('demographics', status, 'pdf', cmsdOnly ? 'cmsd' : undefined));
}
