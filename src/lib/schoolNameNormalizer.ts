/**
 * Normalizes school names so that variations like:
 * - "Garrett Morgan School of Engineering & Innovation"
 * - "Garrett Morgan School of Engineering and Innovation"
 * - "Garrett Morgan High School"
 * - "Garrett Morgan"
 * all map to the same canonical base name for matching purposes.
 *
 * Also supports dynamic aliases loaded from the database.
 */

// Dynamic aliases loaded from the database at runtime
let dynamicAliases: Record<string, string> = {};

export function setSchoolAliases(aliases: { alias: string; canonicalName: string }[]) {
  dynamicAliases = {};
  for (const { alias, canonicalName } of aliases) {
    dynamicAliases[alias.toLowerCase().trim()] = canonicalName.toLowerCase().trim();
  }
}

const STRIP_SUFFIXES = [
  'high school',
  'college and career academy',
  'college & career academy',
  'early college',
  'academy',
  'k-8',
  'k8',
  'hs',
];

// Known alias groups — map various forms to a single canonical name
const SCHOOL_ALIASES: Record<string, string> = {
  'glenville': 'glenville',
  'glenville high school': 'glenville',
  'east tech': 'east technical',
  'east tech high school': 'east technical',
  'east technical': 'east technical',
  'east technical high school': 'east technical',
  'mc2stem': 'mc2stem',
  'mc2 stem': 'mc2stem',
  'campus international': 'campus international',
  'campus international high school': 'campus international',
  'campus international hs': 'campus international',
  'campus international k8': 'campus international',
  'campus international high school - csu cole center': 'campus international',
  // Cleveland schools that must stay distinct
  'cleveland school of the arts': 'cleveland school of the arts',
  'cleveland school of architecture and design': 'cleveland school of architecture and design',
  'cleveland school of architecture & design': 'cleveland school of architecture and design',
  'cleveland school of science and medicine': 'cleveland school of science and medicine',
  'cleveland school of science & medicine': 'cleveland school of science and medicine',
  'cleveland high school for digital arts': 'cleveland high school for digital arts',
};

function stripParenthetical(name: string): string {
  return name.replace(/\s*\(.*?\)\s*/g, ' ').trim();
}

export function normalizeSchoolName(raw: string): string {
  if (!raw) return '';

  let name = stripParenthetical(raw).toLowerCase().trim();

  // Replace & with and for consistency
  name = name.replace(/&/g, 'and');
  // Remove extra whitespace
  name = name.replace(/\s+/g, ' ').trim();

  // Check dynamic aliases from database first
  if (dynamicAliases[name]) return dynamicAliases[name];

  // Check hardcoded aliases
  if (SCHOOL_ALIASES[name]) return SCHOOL_ALIASES[name];

  // Strip suffixes longest-first to get the base name
  const sorted = [...STRIP_SUFFIXES].sort((a, b) => b.length - a.length);
  for (const suffix of sorted) {
    if (name.endsWith(suffix)) {
      const stripped = name.slice(0, -suffix.length).trim();
      if (stripped.length >= 3) {
        name = stripped;
        break;
      }
    }
  }

  // Remove trailing " - " fragments (e.g. "campus international high school - csu cole center")
  name = name.replace(/\s*-\s*.*$/, '').trim();

  // Check aliases again after stripping
  if (dynamicAliases[name]) return dynamicAliases[name];
  if (SCHOOL_ALIASES[name]) return SCHOOL_ALIASES[name];

  return name;
}

/**
 * Returns true if two school names should be considered the same school.
 */
export function schoolNamesMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  return normalizeSchoolName(a) === normalizeSchoolName(b);
}
