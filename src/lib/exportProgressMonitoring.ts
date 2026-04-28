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

function dateTag() { return new Date().toISOString().slice(0, 10); }

// ── Excel ──────────────────────────────────────────────────────
export function exportProgressMonitoringExcel(interns: Intern[]) {
  const filtered = eligible(interns);
  const s = computeStats(filtered);
  const wb = XLSX.utils.book_new();

  const summary: (string | number)[][] = [
    ['EXPLR Internships — Progress Monitoring'],
    ['Generated', new Date().toLocaleString()],
    ['Total Interns', s.total],
    [],
    ['Gender', 'Count', '%'],
    ['Boys', s.boys, s.total ? `${Math.round(s.boys / s.total * 100)}%` : '0%'],
    ['Girls', s.girls, s.total ? `${Math.round(s.girls / s.total * 100)}%` : '0%'],
  ];
  if (s.otherGender) summary.push(['Other / Not Specified', s.otherGender, `${Math.round(s.otherGender / s.total * 100)}%`]);
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
const PRIMARY: [number, number, number] = [22, 135, 120];
const PALETTE: [number, number, number][] = [
  [22, 135, 120], [59, 130, 246], [234, 88, 12], [168, 85, 247],
  [236, 72, 153], [16, 185, 129], [245, 158, 11], [99, 102, 241],
  [239, 68, 68], [14, 165, 233], [132, 204, 22], [217, 70, 239],
];

export function exportProgressMonitoringPDF(interns: Intern[]) {
  const filtered = eligible(interns);
  const s = computeStats(filtered);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = margin;

  const checkPage = (need: number) => {
    if (y + need > pageH - margin) { doc.addPage(); y = margin; }
  };

  const sectionHeader = (title: string) => {
    checkPage(16);
    y += 4;
    doc.setFillColor(...PRIMARY);
    doc.roundedRect(margin, y, contentW, 8, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin + 3, y + 5.7);
    doc.setTextColor(30, 30, 30);
    y += 12;
  };

  const drawBarRow = (label: string, count: number, total: number, color: [number, number, number], labelW = 45) => {
    checkPage(8);
    const pct = total ? Math.round(count / total * 100) : 0;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 40, 40);
    const lbl = label.length > 32 ? label.substring(0, 29) + '…' : label;
    doc.text(lbl, margin + 2, y);
    const barX = margin + labelW;
    const barW = contentW - labelW - 25;
    const fillW = barW * (pct / 100);
    doc.setFillColor(235, 235, 235);
    doc.roundedRect(barX, y - 3.5, barW, 4.5, 1, 1, 'F');
    if (fillW > 0.5) {
      doc.setFillColor(...color);
      doc.roundedRect(barX, y - 3.5, fillW, 4.5, 1, 1, 'F');
    }
    doc.setFontSize(8);
    doc.text(`${count} (${pct}%)`, pageW - margin - 2, y, { align: 'right' });
    y += 7;
  };

  // Donut chart for gender
  const drawDonut = (cx: number, cy: number, r: number, segments: { value: number; color: [number, number, number] }[]) => {
    const total = segments.reduce((sum, seg) => sum + seg.value, 0);
    if (total === 0) return;
    let start = -Math.PI / 2;
    const steps = 64;
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
    doc.circle(cx, cy, r * 0.55, 'F');
    // center text
    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(String(total), cx, cy + 1, { align: 'center' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text('Total', cx, cy + 5, { align: 'center' });
  };

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PRIMARY);
  doc.text('EXPLR Internships', margin, y + 4);
  y += 10;
  doc.setFontSize(13);
  doc.setTextColor(60, 60, 60);
  doc.text('Progress Monitoring Report', margin, y);
  y += 6;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text(`Generated ${new Date().toLocaleString()} · ${s.total} active interns`, margin, y);
  y += 4;
  doc.setDrawColor(210, 210, 210);
  doc.line(margin, y, pageW - margin, y);
  y += 4;

  // Gender — donut + legend
  sectionHeader('Gender Distribution');
  const donutY = y + 22;
  const donutCX = margin + 28;
  drawDonut(donutCX, donutY, 22, [
    { value: s.boys, color: [59, 130, 246] },
    { value: s.girls, color: [236, 72, 153] },
    { value: s.otherGender, color: [156, 163, 175] },
  ]);
  // Legend right of donut
  let legY = y + 4;
  const legX = donutCX + 32;
  const legendItem = (label: string, count: number, color: [number, number, number]) => {
    const pct = s.total ? Math.round(count / s.total * 100) : 0;
    doc.setFillColor(...color);
    doc.roundedRect(legX, legY - 3, 4, 4, 0.5, 0.5, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text(label, legX + 7, legY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(`${count}  (${pct}%)`, legX + 7, legY + 5);
    legY += 12;
  };
  legendItem('Boys', s.boys, [59, 130, 246]);
  legendItem('Girls', s.girls, [236, 72, 153]);
  if (s.otherGender) legendItem('Other / N/A', s.otherGender, [156, 163, 175]);
  y = Math.max(y + 50, legY + 2);

  // Race / Ethnicity bars
  sectionHeader('Race / Ethnicity');
  const raceEntries = Object.entries(s.races).sort((a, b) => b[1] - a[1]);
  const raceTotal = raceEntries.reduce((sum, [, c]) => sum + c, 0);
  raceEntries.forEach(([r, c], idx) => {
    drawBarRow(r, c, raceTotal, PALETTE[idx % PALETTE.length], 60);
  });
  if (raceEntries.length === 0) {
    doc.setFontSize(9); doc.setTextColor(120, 120, 120);
    doc.text('No race / ethnicity data available.', margin + 2, y); y += 6;
  }

  // Grades — horizontal bars
  sectionHeader('Grades');
  const sortedGrades = [
    ...GRADE_ORDER.filter(g => s.grades[g]).map(g => [g, s.grades[g]] as [string, number]),
    ...Object.entries(s.grades).filter(([g]) => !GRADE_ORDER.includes(g)),
  ];
  const gradeTotal = sortedGrades.reduce((sum, [, c]) => sum + c, 0);
  sortedGrades.forEach(([g, c], idx) => {
    drawBarRow(g, c, gradeTotal, PALETTE[idx % PALETTE.length], 30);
  });

  // Age — column chart
  sectionHeader('Age Distribution');
  const ageEntries = Object.entries(s.ages).sort((a, b) => Number(a[0]) - Number(b[0]));
  if (ageEntries.length > 0) {
    checkPage(50);
    const chartX = margin + 5;
    const chartW = contentW - 10;
    const chartH = 38;
    const chartY = y;
    const maxV = Math.max(...ageEntries.map(([, c]) => c));
    const colW = chartW / ageEntries.length;
    // baseline
    doc.setDrawColor(200, 200, 200);
    doc.line(chartX, chartY + chartH, chartX + chartW, chartY + chartH);
    ageEntries.forEach(([age, c], i) => {
      const h = maxV ? (c / maxV) * (chartH - 8) : 0;
      const bx = chartX + colW * i + colW * 0.15;
      const bw = colW * 0.7;
      const by = chartY + chartH - h;
      doc.setFillColor(...PALETTE[i % PALETTE.length]);
      doc.roundedRect(bx, by, bw, h, 0.8, 0.8, 'F');
      // value
      doc.setFontSize(7);
      doc.setTextColor(40, 40, 40);
      doc.text(String(c), bx + bw / 2, by - 1, { align: 'center' });
      // label
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      doc.text(age, bx + bw / 2, chartY + chartH + 4, { align: 'center' });
    });
    y += chartH + 8;
    if (s.ageAvg !== null) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(80, 80, 80);
      doc.text(`Average age: ${s.ageAvg.toFixed(1)} years`, margin + 2, y);
      y += 6;
    }
  } else {
    doc.setFontSize(9); doc.setTextColor(120, 120, 120);
    doc.text('No date-of-birth data available.', margin + 2, y); y += 6;
  }

  // Schools
  sectionHeader(`Schools (${Object.keys(s.schools).length})`);
  const schoolEntries = Object.entries(s.schools).sort((a, b) => b[1] - a[1]);
  const schoolTotal = schoolEntries.reduce((sum, [, c]) => sum + c, 0);
  schoolEntries.forEach(([sc, c], idx) => {
    drawBarRow(sc, c, schoolTotal, PALETTE[idx % PALETTE.length], 75);
  });

  // Footer page numbers
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${p} of ${pageCount}`, pageW - margin, pageH - 6, { align: 'right' });
    doc.text('EXPLR Internships — Progress Monitoring', margin, pageH - 6);
  }

  doc.save(`progress-monitoring-${dateTag()}.pdf`);
}