import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import type { Intern } from '@/types/intern';

const GRADE_ORDER = ['8th', '9th', '10th', '11th', '12th'];

function calcAge(dob: string): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 && age < 100 ? age : null;
}

interface PMStats {
  total: number;
  boys: number;
  girls: number;
  otherGender: number;
  races: Record<string, number>;
  schools: Record<string, number>;
  grades: Record<string, number>;
  ages: Record<string, number>;
  ageAvg: number | null;
  ellYes: number;
  ellNo: number;
  statuses: Record<string, number>;
}

function isMale(g: string) { return /^(m|male|boy|man)$/i.test(g.trim()); }
function isFemale(g: string) { return /^(f|female|girl|woman)$/i.test(g.trim()); }

function computeStats(interns: Intern[]): PMStats {
  const races: Record<string, number> = {};
  const schools: Record<string, number> = {};
  const grades: Record<string, number> = {};
  const ages: Record<string, number> = {};
  const statuses: Record<string, number> = {};
  let boys = 0, girls = 0, other = 0;
  let ageSum = 0, ageCount = 0;
  let ellYes = 0, ellNo = 0;

  for (const i of interns) {
    const g = (i.gender || '').trim();
    if (isMale(g)) boys++;
    else if (isFemale(g)) girls++;
    else if (g) other++;

    if (i.raceEthnicity) {
      const parts = i.raceEthnicity.includes(';')
        ? i.raceEthnicity.split(';').map(s => s.trim()).filter(Boolean)
        : [i.raceEthnicity];
      for (const r of parts) races[r] = (races[r] || 0) + 1;
    }

    const school = (i.otherSchool || i.school || 'Unknown').trim() || 'Unknown';
    schools[school] = (schools[school] || 0) + 1;

    const grade = i.grade || 'Unknown';
    grades[grade] = (grades[grade] || 0) + 1;

    const age = calcAge(i.dob);
    if (age !== null) {
      ages[String(age)] = (ages[String(age)] || 0) + 1;
      ageSum += age;
      ageCount++;
    }

    if (i.isEll) ellYes++; else ellNo++;

    const st = i.status || 'pending';
    statuses[st] = (statuses[st] || 0) + 1;
  }

  return {
    total: interns.length,
    boys, girls, otherGender: other,
    races, schools, grades, ages,
    ageAvg: ageCount ? ageSum / ageCount : null,
    ellYes, ellNo, statuses,
  };
}

function eligible(interns: Intern[]): Intern[] {
  return interns.filter(i => i.isNewest && i.status === 'ready_to_place');
}

function eligibleForSpreadsheet(interns: Intern[]): Intern[] {
  return interns.filter(
    i => i.isNewest && (i.status === 'ready_to_place' || i.status === 'in_progress_you'),
  );
}

function dateTag() { return new Date().toISOString().slice(0, 10); }

// ── Excel ──────────────────────────────────────────────────────
export function exportProgressMonitoringExcel(interns: Intern[]) {
  const filtered = eligibleForSpreadsheet(interns);
  const s = computeStats(filtered);
  const wb = XLSX.utils.book_new();

  const summary: (string | number)[][] = [
    ['EXPLR Internships — Progress Monitoring (Ready to Place + Upcoming Appointments)'],
    ['Generated', new Date().toLocaleString()],
    ['Total Interns', s.total],
    ['  • Ready to Place', s.statuses['ready_to_place'] || 0],
    ['  • Upcoming Appointment', s.statuses['in_progress_you'] || 0],
    [],
    ['Gender', 'Count', '%'],
    ['Boys', s.boys, s.total ? `${Math.round(s.boys / s.total * 100)}%` : '0%'],
    ['Girls', s.girls, s.total ? `${Math.round(s.girls / s.total * 100)}%` : '0%'],
  ];
  if (s.otherGender) summary.push(['Other / Not Specified', s.otherGender, `${Math.round(s.otherGender / s.total * 100)}%`]);
  summary.push([], ['ELL Status', 'Count', '%']);
  summary.push(['ELL', s.ellYes, s.total ? `${Math.round(s.ellYes / s.total * 100)}%` : '0%']);
  summary.push(['Non-ELL', s.ellNo, s.total ? `${Math.round(s.ellNo / s.total * 100)}%` : '0%']);
  // Replace any "Boys"/"Girls" labels with Males/Females in the existing rows above
  for (const row of summary) {
    if (row[0] === 'Boys') row[0] = 'Males';
    if (row[0] === 'Girls') row[0] = 'Females';
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), 'Summary');

  // Race / Ethnicity
  const raceRows: (string | number)[][] = [['Race / Ethnicity', 'Count', '%']];
  Object.entries(s.races).sort((a, b) => b[1] - a[1]).forEach(([r, c]) =>
    raceRows.push([r, c, s.total ? `${Math.round(c / s.total * 100)}%` : '0%'])
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(raceRows), 'Race Ethnicity');

  // Schools
  const schoolRows: (string | number)[][] = [['School', 'Count']];
  Object.entries(s.schools).sort((a, b) => b[1] - a[1]).forEach(([sc, c]) => schoolRows.push([sc, c]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(schoolRows), 'Schools');

  // Age
  const ageRows: (string | number)[][] = [['Age', 'Count']];
  Object.entries(s.ages).sort((a, b) => Number(a[0]) - Number(b[0])).forEach(([a, c]) => ageRows.push([a, c]));
  if (s.ageAvg !== null) ageRows.push([], ['Average Age', s.ageAvg.toFixed(1)]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ageRows), 'Age');

  // Grades
  const gradeRows: (string | number)[][] = [['Grade', 'Count', '%']];
  const sortedGrades = [
    ...GRADE_ORDER.filter(g => s.grades[g]).map(g => [g, s.grades[g]] as [string, number]),
    ...Object.entries(s.grades).filter(([g]) => !GRADE_ORDER.includes(g)),
  ];
  sortedGrades.forEach(([g, c]) =>
    gradeRows.push([g, c, s.total ? `${Math.round(c / s.total * 100)}%` : '0%'])
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(gradeRows), 'Grades');

  XLSX.writeFile(wb, `progress-monitoring-${dateTag()}.xlsx`);
}

// ── PDF ────────────────────────────────────────────────────────
// Refined, professional palette: deep navy primary, teal accent, neutral grays
const PRIMARY: [number, number, number] = [15, 36, 64];      // deep navy
const ACCENT: [number, number, number] = [22, 135, 120];     // teal
const TEXT_DARK: [number, number, number] = [25, 32, 45];
const TEXT_MUTED: [number, number, number] = [110, 118, 130];
const RULE: [number, number, number] = [220, 224, 230];
const TRACK: [number, number, number] = [238, 240, 244];
// Restrained categorical palette tuned for print
const PALETTE: [number, number, number][] = [
  [15, 76, 117],   // navy-blue
  [22, 135, 120],  // teal
  [199, 124, 36],  // amber
  [120, 78, 168],  // purple
  [180, 70, 110],  // rose
  [60, 130, 90],   // green
  [80, 100, 140],  // slate
  [205, 92, 76],   // brick
  [70, 140, 170],  // sky
  [150, 130, 60],  // olive
];

export function exportProgressMonitoringPDF(interns: Intern[]) {
  const filtered = eligible(interns);
  const s = computeStats(filtered);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentW = pageW - margin * 2;
  let y = margin;

  const checkPage = (need: number) => {
    if (y + need > pageH - margin - 8) { doc.addPage(); y = margin; }
  };

  const sectionHeader = (title: string) => {
    checkPage(18);
    y += 6;
    // Thin accent bar + uppercase label — editorial / report style
    doc.setFillColor(...ACCENT);
    doc.rect(margin, y, 2, 5.5, 'F');
    doc.setTextColor(...PRIMARY);
    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.text(title.toUpperCase(), margin + 5, y + 4.2);
    // hairline rule under the title
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.2);
    doc.line(margin, y + 7.5, pageW - margin, y + 7.5);
    doc.setTextColor(...TEXT_DARK);
    y += 12;
  };

  const drawBarRow = (label: string, count: number, total: number, color: [number, number, number], labelW = 45) => {
    checkPage(8);
    const pct = total ? Math.round(count / total * 100) : 0;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT_DARK);
    const lbl = label.length > 32 ? label.substring(0, 29) + '…' : label;
    doc.text(lbl, margin, y);
    const barX = margin + labelW;
    const barW = contentW - labelW - 22;
    const fillW = barW * (pct / 100);
    doc.setFillColor(...TRACK);
    doc.rect(barX, y - 3, barW, 3.6, 'F');
    if (fillW > 0.5) {
      doc.setFillColor(...color);
      doc.rect(barX, y - 3, fillW, 3.6, 'F');
    }
    doc.setFontSize(8.5);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(`${count}  ·  ${pct}%`, pageW - margin, y, { align: 'right' });
    y += 7;
  };

  // Donut chart for gender
  const drawDonut = (cx: number, cy: number, r: number, segments: { value: number; color: [number, number, number] }[]) => {
    const total = segments.reduce((sum, seg) => sum + seg.value, 0);
    if (total === 0) return;
    let start = -Math.PI / 2;
    const steps = 96;
    for (const seg of segments) {
      const angle = (seg.value / total) * Math.PI * 2;
      if (angle <= 0) continue;
      doc.setFillColor(...seg.color);
      // approximate pie slice via triangle fan
      const stepCount = Math.max(2, Math.round((angle / (Math.PI * 2)) * steps));
      const stepAngle = angle / stepCount;
      for (let i = 0; i < stepCount; i++) {
        const a1 = start + i * stepAngle;
        const a2 = start + (i + 1) * stepAngle;
        doc.triangle(
          cx, cy,
          cx + Math.cos(a1) * r, cy + Math.sin(a1) * r,
          cx + Math.cos(a2) * r, cy + Math.sin(a2) * r,
          'F'
        );
      }
      start += angle;
    }
    // inner white circle for donut effect
    doc.setFillColor(255, 255, 255);
    doc.circle(cx, cy, r * 0.62, 'F');
    // center text
    doc.setTextColor(...PRIMARY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(String(total), cx, cy + 1, { align: 'center' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT_MUTED);
    doc.text('TOTAL', cx, cy + 5, { align: 'center' });
  };

  // ── Cover header ───────────────────────────────────────────
  // Top accent band
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, pageW, 4, 'F');
  doc.setFillColor(...ACCENT);
  doc.rect(0, 4, pageW, 1, 'F');

  y = margin + 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MUTED);
  doc.text('EXPLR INTERNSHIPS  ·  PROGRESS MONITORING', margin, y);
  doc.text(new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }),
           pageW - margin, y, { align: 'right' });
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...PRIMARY);
  doc.text('Progress Monitoring Report', margin, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...TEXT_MUTED);
  doc.text('Demographic snapshot of interns ready to be placed.', margin, y);
  y += 6;
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);
  y += 4;

  if (s.total === 0) {
    sectionHeader('No Data');
    doc.setFontSize(10);
    doc.setTextColor(...TEXT_MUTED);
    doc.text('No students currently have status "Ready to Place".', margin, y);
    doc.save(`progress-monitoring-${dateTag()}.pdf`);
    return;
  }

  // ── KPI Strip ──────────────────────────────────────────────
  const kpiH = 18;
  const kpiGap = 4;
  const kpis: { label: string; value: string }[] = [
    { label: 'Ready to Place', value: String(s.total) },
    { label: 'Schools', value: String(Object.keys(s.schools).length) },
    { label: 'Avg. Age', value: s.ageAvg !== null ? s.ageAvg.toFixed(1) : '—' },
    { label: 'ELL', value: s.total ? `${Math.round(s.ellYes / s.total * 100)}%` : '—' },
  ];
  const kpiW = (contentW - kpiGap * (kpis.length - 1)) / kpis.length;
  kpis.forEach((kpi, i) => {
    const kx = margin + i * (kpiW + kpiGap);
    doc.setFillColor(250, 251, 253);
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.2);
    doc.roundedRect(kx, y, kpiW, kpiH, 1, 1, 'FD');
    doc.setFillColor(...ACCENT);
    doc.rect(kx, y, 1.2, kpiH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(...PRIMARY);
    doc.text(kpi.value, kx + 4, y + 9);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(kpi.label.toUpperCase(), kx + 4, y + 14);
  });
  y += kpiH + 4;

  // ── Gender — donut + legend ────────────────────────────────
  sectionHeader('Gender Distribution');
  const donutY = y + 22;
  const donutCX = margin + 26;
  drawDonut(donutCX, donutY, 22, [
    { value: s.boys, color: PALETTE[0] },
    { value: s.girls, color: PALETTE[3] },
    { value: s.otherGender, color: [160, 168, 178] },
  ]);
  // Legend right of donut
  let legY = y + 6;
  const legX = donutCX + 34;
  const legendItem = (label: string, count: number, color: [number, number, number]) => {
    const pct = s.total ? Math.round(count / s.total * 100) : 0;
    doc.setFillColor(...color);
    doc.rect(legX, legY - 3, 3, 3, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PRIMARY);
    doc.text(label, legX + 6, legY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(`${count}   ${pct}%`, legX + 6, legY + 4.5);
    legY += 11;
  };
  legendItem('Males', s.boys, PALETTE[0]);
  legendItem('Females', s.girls, PALETTE[3]);
  if (s.otherGender) legendItem('Other / N/A', s.otherGender, [160, 168, 178]);
  y = Math.max(y + 50, legY + 2);

  // Race / Ethnicity bars
  sectionHeader('Race / Ethnicity');
  const raceEntries = Object.entries(s.races).sort((a, b) => b[1] - a[1]);
  const raceTotal = raceEntries.reduce((sum, [, c]) => sum + c, 0);
  raceEntries.forEach(([r, c]) => {
    drawBarRow(r, c, raceTotal, ACCENT, 60);
  });
  if (raceEntries.length === 0) {
    doc.setFontSize(9); doc.setTextColor(...TEXT_MUTED);
    doc.text('No race / ethnicity data available.', margin, y); y += 6;
  }

  // Grades — horizontal bars
  sectionHeader('Grades');
  const sortedGrades = [
    ...GRADE_ORDER.filter(g => s.grades[g]).map(g => [g, s.grades[g]] as [string, number]),
    ...Object.entries(s.grades).filter(([g]) => !GRADE_ORDER.includes(g)),
  ];
  const gradeTotal = sortedGrades.reduce((sum, [, c]) => sum + c, 0);
  sortedGrades.forEach(([g, c]) => {
    drawBarRow(g, c, gradeTotal, PRIMARY, 30);
  });

  // Age — column chart
  sectionHeader('Age Distribution');
  const ageEntries = Object.entries(s.ages).sort((a, b) => Number(a[0]) - Number(b[0]));
  if (ageEntries.length > 0) {
    checkPage(54);
    const chartX = margin + 5;
    const chartW = contentW - 10;
    const chartH = 40;
    const chartY = y;
    const maxV = Math.max(...ageEntries.map(([, c]) => c));
    const colW = chartW / ageEntries.length;
    // gridlines (4 horizontal)
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.15);
    for (let g = 0; g <= 4; g++) {
      const gy = chartY + (chartH - 8) * (g / 4) + 2;
      doc.line(chartX, gy, chartX + chartW, gy);
    }
    // baseline
    doc.setDrawColor(...PRIMARY);
    doc.setLineWidth(0.4);
    doc.line(chartX, chartY + chartH - 6, chartX + chartW, chartY + chartH - 6);
    ageEntries.forEach(([age, c], i) => {
      const h = maxV ? (c / maxV) * (chartH - 10) : 0;
      const bx = chartX + colW * i + colW * 0.18;
      const bw = colW * 0.64;
      const by = chartY + chartH - h;
      doc.setFillColor(...ACCENT);
      doc.rect(bx, by - 6, bw, h, 'F');
      // value
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...PRIMARY);
      doc.text(String(c), bx + bw / 2, by - 7, { align: 'center' });
      // label
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...TEXT_MUTED);
      doc.text(age, bx + bw / 2, chartY + chartH + 2, { align: 'center' });
    });
    y += chartH + 6;
    if (s.ageAvg !== null) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(...TEXT_MUTED);
      doc.text(`Average age: ${s.ageAvg.toFixed(1)} years`, margin, y);
      y += 6;
    }
  } else {
    doc.setFontSize(9); doc.setTextColor(...TEXT_MUTED);
    doc.text('No date-of-birth data available.', margin, y); y += 6;
  }

  // Schools
  sectionHeader(`Schools (${Object.keys(s.schools).length})`);
  const schoolEntries = Object.entries(s.schools).sort((a, b) => b[1] - a[1]);
  const schoolTotal = schoolEntries.reduce((sum, [, c]) => sum + c, 0);
  schoolEntries.forEach(([sc, c]) => {
    drawBarRow(sc, c, schoolTotal, PRIMARY, 75);
  });

  // ELL Status
  sectionHeader('ELL Status');
  drawBarRow('ELL', s.ellYes, s.total, ACCENT, 45);
  drawBarRow('Non-ELL', s.ellNo, s.total, [160, 168, 178], 45);

  // Footer page numbers
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    // footer rule
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.2);
    doc.line(margin, pageH - 10, pageW - margin, pageH - 10);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT_MUTED);
    doc.text('EXPLR Internships  ·  Progress Monitoring Report', margin, pageH - 6);
    doc.text(`Page ${p} of ${pageCount}`, pageW - margin, pageH - 6, { align: 'right' });
  }

  doc.save(`progress-monitoring-${dateTag()}.pdf`);
}