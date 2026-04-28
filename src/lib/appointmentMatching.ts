import * as XLSX from 'xlsx';
import type { Intern } from '@/types/intern';

const NAME_NOISE_TOKENS = new Set([
  'jr', 'sr', 'ii', 'iii', 'iv', 'v', 'mr', 'mrs', 'ms', 'miss', 'mister',
  'male', 'female', 'freshman', 'soph', 'sophmore', 'sophomore', 'junior', 'senior',
  'men', 'woman', 'girl', 'boy', 'na', 'none', 'unknown', 'tmb', 'jj', 'ej', 'rb', 'ixj',
]);

export interface ParsedAppointment {
  uploadedName: string;
  firstName: string;
  lastName: string;
  dob: string;
  email: string;
  date: string;
  time: string;
  location: string;
}

export interface AppointmentMatchSuggestion {
  internId: string;
  internName: string;
  internDob: string;
  internEmail: string;
  score: number;
  matchedBy: string[];
}

export interface AppointmentReviewItem {
  appointment: ParsedAppointment;
  suggestion: AppointmentMatchSuggestion;
  approved?: boolean;
}

export function normalizeName(value: string): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[’'`.-]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeDob(dob: string | number): string {
  if (!dob && dob !== 0) return '';

  if (typeof dob === 'number') {
    const d = XLSX.SSF.parse_date_code(dob);
    if (d) return `${d.m}/${d.d}/${d.y}`;
    return '';
  }

  const cleaned = String(dob).trim();
  if (!cleaned) return '';

  const parts = cleaned.split(/[\/\-.]/);
  if (parts.length === 3) {
    const m = parseInt(parts[0], 10);
    const d = parseInt(parts[1], 10);
    const y = parseInt(parts[2], 10);
    if (!Number.isNaN(m) && !Number.isNaN(d) && !Number.isNaN(y)) {
      const fullYear = y < 100 ? (y > 50 ? 1900 + y : 2000 + y) : y;
      return `${m}/${d}/${fullYear}`;
    }
  }

  return cleaned.toLowerCase();
}

function normalizeEmail(email: string): string {
  return String(email ?? '').trim().toLowerCase();
}

function parseExcelDate(raw: unknown): string {
  if (raw instanceof Date) return raw.toLocaleDateString();
  if (typeof raw === 'number') {
    const d = XLSX.SSF.parse_date_code(raw);
    if (d) return `${d.m}/${d.d}/${d.y}`;
  }
  return String(raw ?? '').trim();
}

function parseExcelTime(raw: unknown): string {
  if (typeof raw === 'number' && raw < 1) {
    const totalMinutes = Math.round(raw * 24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const h12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${h12}:${String(minutes).padStart(2, '0')} ${ampm}`;
  }
  return String(raw ?? '').trim();
}

function findColumn(headers: string[], ...searches: string[]): number {
  for (const search of searches) {
    const index = headers.findIndex((header) => header && header.toLowerCase().includes(search.toLowerCase()));
    if (index >= 0) return index;
  }
  return -1;
}

function getNameTokens(name: string): string[] {
  return normalizeName(name)
    .split(' ')
    .filter(Boolean)
    .filter((token) => token.length > 1 && !NAME_NOISE_TOKENS.has(token));
}

function compareToken(left: string, right: string): number {
  if (left === right) return 1;
  if (left.startsWith(right) || right.startsWith(left)) return 0.85;

  let prefix = 0;
  while (prefix < left.length && prefix < right.length && left[prefix] === right[prefix]) prefix += 1;
  return prefix >= 4 ? 0.7 : 0;
}

function calculateNameScore(uploadedName: string, rosterName: string): number {
  const leftTokens = getNameTokens(uploadedName);
  const rightTokens = getNameTokens(rosterName);

  if (!leftTokens.length || !rightTokens.length) return 0;

  const averageBest = (source: string[], target: string[]) =>
    source.reduce((sum, token) => sum + Math.max(...target.map((candidate) => compareToken(token, candidate)), 0), 0) / source.length;

  return Math.min(1, (averageBest(leftTokens, rightTokens) + averageBest(rightTokens, leftTokens)) / 2);
}

function splitUploadedName(rawName: string) {
  const parts = String(rawName ?? '').trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || '',
    lastName: parts.length > 1 ? parts[parts.length - 1] : '',
  };
}

function buildUploadedName(firstName: string, lastName: string, fullName: string): string {
  if (fullName.trim()) return fullName.trim();
  return `${firstName} ${lastName}`.trim();
}

function buildMatchSuggestion(appointment: ParsedAppointment, intern: Intern): AppointmentMatchSuggestion {
  const uploadedName = appointment.uploadedName || `${appointment.firstName} ${appointment.lastName}`.trim();
  const rosterName = `${intern.firstName} ${intern.lastName}`.trim();
  const nameScore = calculateNameScore(uploadedName, rosterName);
  const dobScore = normalizeDob(appointment.dob) && normalizeDob(appointment.dob) === normalizeDob(intern.dob) ? 1 : 0;
  const appointmentEmail = normalizeEmail(appointment.email);
  const internEmail = normalizeEmail(intern.studentEmail || intern.emailSubmission);
  const emailScore = appointmentEmail && appointmentEmail === internEmail ? 1 : 0;
  const score = (nameScore * 0.55) + (dobScore * 0.3) + (emailScore * 0.15);

  const matchedBy: string[] = [];
  if (nameScore >= 0.95) matchedBy.push('Exact name');
  else if (nameScore >= 0.7) matchedBy.push('Whole name');
  else if (nameScore >= 0.45) matchedBy.push('Partial name');
  if (dobScore === 1) matchedBy.push('DOB');
  if (emailScore === 1) matchedBy.push('Email');

  return {
    internId: intern.id,
    internName: rosterName,
    internDob: intern.dob,
    internEmail: intern.studentEmail || intern.emailSubmission,
    score,
    matchedBy,
  };
}

export function buildAppointmentLabel(appointment: ParsedAppointment): string {
  const name = appointment.uploadedName || `${appointment.firstName} ${appointment.lastName}`.trim() || 'Unnamed student';
  return `${name}${appointment.dob ? ` (DOB: ${appointment.dob})` : ''}`;
}

export function parseAppointmentFile(data: ArrayBuffer): ParsedAppointment[] {
  const workbook = XLSX.read(data, { type: 'array' });
  const results: ParsedAppointment[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (rows.length < 2) continue;

    let headerIndex = -1;
    for (let i = 0; i < Math.min(rows.length, 15); i += 1) {
      const cells = (rows[i] || []).map((cell) => String(cell ?? '').toLowerCase());
      const rowText = cells.join(' ');
      if (rowText.includes('name') && (rowText.includes('date') || rowText.includes('time') || rowText.includes('appointment') || rowText.includes('birth'))) {
        headerIndex = i;
        break;
      }
    }
    if (headerIndex < 0) continue;

    const headers = rows[headerIndex].map((header) => String(header ?? ''));
    const firstNameIndex = findColumn(headers, 'first name', 'yp first name');
    const lastNameIndex = findColumn(headers, 'last name', 'yp last name');
    const fullNameIndex = (firstNameIndex >= 0 && lastNameIndex >= 0)
      ? -1
      : findColumn(headers, 'full name', 'student name', 'youth name', 'name');
    const dobIndex = findColumn(headers, 'birthdate', 'birth date', 'date of birth', 'dob', 'birthday');
    const emailIndex = findColumn(headers, 'email', 'e-mail');
    const dateIndex = findColumn(headers, 'appointment date', 'intake date', 'date');
    const timeIndex = findColumn(headers, 'time', 'appointment time', 'intake time');
    const locationIndex = findColumn(headers, 'address', 'location', 'site', 'place', 'where');
    const effectiveDateIndex = dateIndex === dobIndex ? -1 : dateIndex;

    for (const row of rows.slice(headerIndex + 1)) {
      if (!row || row.every((cell) => !String(cell ?? '').trim())) continue;

      const rawFirstName = firstNameIndex >= 0 ? String(row[firstNameIndex] ?? '').trim() : '';
      const rawLastName = lastNameIndex >= 0 ? String(row[lastNameIndex] ?? '').trim() : '';
      const rawFullName = fullNameIndex >= 0 ? String(row[fullNameIndex] ?? '').trim() : '';
      const uploadedName = buildUploadedName(rawFirstName, rawLastName, rawFullName);
      const splitName = splitUploadedName(uploadedName);

      if (!uploadedName && !splitName.firstName) continue;

      let dateValue = effectiveDateIndex >= 0 ? parseExcelDate(row[effectiveDateIndex]) : '';
      let timeValue = timeIndex >= 0 ? parseExcelTime(row[timeIndex]) : '';

      if (!timeValue && dateValue.includes(' ')) {
        const combinedMatch = dateValue.match(/^(.*?)(\d{1,2}:\d{2}(?:\s?[AP]M)?)$/i);
        if (combinedMatch) {
          dateValue = combinedMatch[1].trim();
          timeValue = combinedMatch[2].trim();
        }
      }

      results.push({
        uploadedName,
        firstName: splitName.firstName,
        lastName: splitName.lastName,
        dob: dobIndex >= 0 ? parseExcelDate(row[dobIndex]) : '',
        email: emailIndex >= 0 ? String(row[emailIndex] ?? '').trim() : '',
        date: dateValue,
        time: timeValue,
        location: locationIndex >= 0 ? String(row[locationIndex] ?? '').trim() : '',
      });
    }

    if (results.length > 0) break;
  }

  return results;
}

export function dedupeAppointments(appointments: ParsedAppointment[]): ParsedAppointment[] {
  const seen = new Set<string>();
  const unique: ParsedAppointment[] = [];
  for (const appointment of appointments) {
    const nameKey = normalizeName(appointment.uploadedName || `${appointment.firstName} ${appointment.lastName}`);
    const dobKey = normalizeDob(appointment.dob);
    const emailKey = normalizeEmail(appointment.email);
    const dateKey = (appointment.date || '').trim().toLowerCase();
    const timeKey = (appointment.time || '').trim().toLowerCase();
    const key = `${nameKey}|${dobKey}|${emailKey}|${dateKey}|${timeKey}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(appointment);
  }
  return unique;
}

export function findAutoAppointmentMatch(appointment: ParsedAppointment, interns: Intern[]): Intern | null {
  const normalizedDob = normalizeDob(appointment.dob);
  const normalizedEmail = normalizeEmail(appointment.email);
  const normalizedFirst = normalizeName(appointment.firstName);
  const normalizedLast = normalizeName(appointment.lastName);

  if (normalizedEmail) {
    const emailMatches = interns.filter((intern) => normalizeEmail(intern.studentEmail || intern.emailSubmission) === normalizedEmail);
    if (emailMatches.length === 1) {
      if (!normalizedDob || normalizeDob(emailMatches[0].dob) === normalizedDob) return emailMatches[0];
    }
  }

  if (normalizedFirst && normalizedLast) {
    const exactNameMatches = interns.filter(
      (intern) => normalizeName(intern.firstName) === normalizedFirst && normalizeName(intern.lastName) === normalizedLast,
    );

    if (exactNameMatches.length === 1) {
      if (!normalizedDob || normalizeDob(exactNameMatches[0].dob) === normalizedDob) return exactNameMatches[0];
    }

    if (exactNameMatches.length > 1 && normalizedDob) {
      const dobMatch = exactNameMatches.find((intern) => normalizeDob(intern.dob) === normalizedDob);
      if (dobMatch) return dobMatch;
    }
  }

  return null;
}

export function findBestAppointmentSuggestion(appointment: ParsedAppointment, interns: Intern[]): AppointmentMatchSuggestion | null {
  const suggestions = interns
    .map((intern) => buildMatchSuggestion(appointment, intern))
    .sort((left, right) => right.score - left.score);

  return suggestions[0] || null;
}

export function isUsefulAppointmentSuggestion(suggestion: AppointmentMatchSuggestion | null): suggestion is AppointmentMatchSuggestion {
  if (!suggestion) return false;
  return suggestion.score >= 0.35 || suggestion.matchedBy.includes('DOB') || suggestion.matchedBy.includes('Email');
}
