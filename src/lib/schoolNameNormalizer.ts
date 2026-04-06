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
  'prek to 8 school',
  'prek-8 school',
  'prek to 8',
  'prek-8',
  'pre k-8',
  'pre k to 8',
  'k-8 school',
  'k8 school',
  'k-8',
  'k8',
  'school',
  'hs',
];

// Known alias groups — map various forms to a single canonical name
const SCHOOL_ALIASES: Record<string, string> = {
  // Glenville
  'glenville': 'glenville',
  'glenville high school': 'glenville',
  // East Technical
  'east tech': 'east technical',
  'east tech high school': 'east technical',
  'east technical': 'east technical',
  'east technical high school': 'east technical',
  // MC2STEM
  'mc2stem': 'mc2stem',
  'mc2 stem': 'mc2stem',
  'mc2stem high school': 'mc2stem',
  // Campus International
  'campus international': 'campus international',
  'campus international high school': 'campus international',
  'campus international hs': 'campus international',
  'campus international k8': 'campus international',
  'campus international high school - csu cole center': 'campus international',
  // Cleveland schools — each is distinct
  'cleveland school of the arts': 'cleveland school of the arts',
  'cleveland school of architecture and design': 'cleveland school of architecture and design',
  'cleveland school of architecture & design': 'cleveland school of architecture and design',
  'cleveland school of science and medicine': 'cleveland school of science and medicine',
  'cleveland school of science & medicine': 'cleveland school of science and medicine',
  'cleveland high school for digital arts': 'cleveland high school for digital arts',
  // Garrett Morgan — Engineering vs Leadership are DIFFERENT schools
  'garrett morgan school of engineering and innovation': 'garrett morgan engineering',
  'garrett morgan school of engineering & innovation': 'garrett morgan engineering',
  'garrett morgan school of engineering': 'garrett morgan engineering',
  'garrett morgan school of leadership and innovation': 'garrett morgan leadership',
  'garrett morgan school of leadership & innovation': 'garrett morgan leadership',
  'garrett morgan school of leadership': 'garrett morgan leadership',
  // John Marshall — 3 different schools
  'john marshall school of civic and business leadership': 'john marshall civic and business leadership',
  'john marshall school of civic & business leadership': 'john marshall civic and business leadership',
  'john marshall school of business and civic leadership': 'john marshall civic and business leadership',
  'john marshall school of business & civic leadership': 'john marshall civic and business leadership',
  'john marshall school of engineering': 'john marshall engineering',
  'john marshall school of information technology': 'john marshall information technology',
  // Lincoln-West — 2 different schools
  'lincoln-west school of global studies': 'lincoln-west global studies',
  'lincoln west school of global studies': 'lincoln-west global studies',
  'lincoln-west school of science and health': 'lincoln-west science and health',
  'lincoln-west school of science & health': 'lincoln-west science and health',
  'lincoln west school of science and health': 'lincoln-west science and health',
  'lincoln west school of science & health': 'lincoln-west science and health',
  // Rhodes — 2 different schools
  'rhodes college and career academy': 'rhodes college and career academy',
  'rhodes college & career academy': 'rhodes college and career academy',
  'rhodes school of environmental studies': 'rhodes environmental studies',
  // Dike — keep distinct from other "school of the arts"
  'dike school of the arts': 'dike school of the arts',
  // Natividad Pagan
  'natividad pagan international newcomers academy': 'natividad pagan international newcomers academy',
  'natividad pagan international newcomers academy-high school': 'natividad pagan international newcomers academy',
  // John Adams
  'john adams college and career academy': 'john adams',
  'john adams college & career academy': 'john adams',
  // Davis Aerospace
  'davis aerospace and maritime high school': 'davis aerospace and maritime',
  'davis aerospace & maritime high school': 'davis aerospace and maritime',
  // Stonebrook-White (prevent hyphen stripping)
  'stonebrook-white montessori campus': 'stonebrook-white montessori',
  // John F Kennedy (with/without period)
  'john f. kennedy high school': 'john f kennedy',
  'john f kennedy high school': 'john f kennedy',
  // Bard Early College
  'bard high school early college cleveland': 'bard early college',
  'bard high school early college': 'bard early college',
  // Warner Girls Leadership Academy
  'warner girls leadership academy': 'warner girls leadership academy',
  // Mary B. Martin
  'mary b martin': 'mary b martin',
  'mary b. martin': 'mary b martin',
};

function stripParenthetical(name: string): string {
  return name.replace(/\s*\(.*?\)\s*/g, ' ').trim();
}

export function normalizeSchoolName(raw: string): string {
  if (!raw) return '';

  let name = stripParenthetical(raw).toLowerCase().trim();

  // Replace & with and for consistency
  name = name.replace(/&/g, 'and');
  // Remove apostrophes/smart quotes for consistency
  name = name.replace(/[''`]/g, '');
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
