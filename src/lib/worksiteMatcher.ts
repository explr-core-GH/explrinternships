import type { Intern, Worksite, Assignment, DirectInterestFieldKey } from '@/types/intern';

/**
 * Worksite-centric matcher: given a single worksite, score and rank all
 * interns by how well their interest-form responses fit. This is the
 * inverse of `placementEngine.generatePlacements`, which goes the other
 * way (one intern -> top worksites).
 *
 * Scoring is data-driven: a worksite declares which Yes/Maybe/No interest
 * fields on the Intern record it should be scored against, via
 * `worksite.interestFieldKeys`. This means renaming or repurposing a
 * worksite (e.g. IERS Center -> NASA Internship) is a UI edit, not a
 * code change.
 */

export interface InternMatch {
  intern: Intern;
  score: number;
  reasons: string[];
  alreadyAssignedHere: boolean;
  alreadyAssignedElsewhere: boolean;
}

// Map free-text "IT interest" multi-select values to worksite categories.
// This is the only string-matching layer that remains hardcoded; new
// IT-interest options that don't show up here will still match via the
// specificInterests/tags substring path.
const IT_INTEREST_TO_CATEGORY: Record<string, string[]> = {
  'working at an it help desk': ['Technology / IT'],
  'data science': ['Technology / IT', 'Research'],
  'building prosthetic hands': ['Engineering', 'Healthcare'],
  'building prostethic hands': ['Engineering', 'Healthcare'], // legacy typo from existing data
  'quantum computing': ['Technology / IT', 'Research'],
  'artificial intelligence': ['Technology / IT', 'Research'],
  'building a website': ['Technology / IT', 'Design / Creative'],
  'cyber security': ['Technology / IT'],
  'building a pc': ['Technology / IT', 'Engineering'],
  'industrial robotics': ['Manufacturing', 'Engineering'],
  'designing video games': ['Design / Creative', 'Technology / IT'],
  'building a robot': ['Engineering', 'Manufacturing'],
  'project management': ['Business / Management'],
};

function readDirectField(intern: Intern, key: DirectInterestFieldKey): string {
  const v = (intern as unknown as Record<string, unknown>)[key];
  return typeof v === 'string' ? v : '';
}

function scoreDirectField(intern: Intern, key: DirectInterestFieldKey): number {
  const v = readDirectField(intern, key);
  if (v === 'Yes') return 6;   // strong signal
  if (v === 'Maybe') return 2; // soft signal
  return 0;
}

export interface ScoreOptions {
  enforceCapacity?: boolean;
}

/**
 * Score one intern against one worksite. Exported separately so the
 * caller can show a pair-level breakdown.
 */
export function scoreInternWorksite(
  intern: Intern,
  worksite: Worksite,
  opts: ScoreOptions = { enforceCapacity: true },
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // 1) Direct interest fields declared on this worksite.
  // Reason text uses the worksite's name so it stays accurate even if
  // an interest field's meaning changes (e.g. iersCenter -> NASA).
  const keys = worksite.interestFieldKeys || [];
  let directHit: 'yes' | 'maybe' | null = null;
  for (const key of keys) {
    const s = scoreDirectField(intern, key);
    if (s > 0) {
      score += s;
      directHit = s === 6 ? 'yes' : (directHit === 'yes' ? 'yes' : 'maybe');
    }
  }
  if (directHit === 'yes') {
    reasons.push(`Yes — interested in ${worksite.name}`);
  } else if (directHit === 'maybe') {
    reasons.push(`Maybe — interested in ${worksite.name}`);
  }

  // 2) IT-interest multi-select -> worksite category.
  const seenItReasons = new Set<string>();
  for (const interest of intern.itInterests || []) {
    const lower = interest.toLowerCase().trim();
    for (const [k, cats] of Object.entries(IT_INTEREST_TO_CATEGORY)) {
      const matches = lower === k || lower.includes(k) || (lower.length >= 6 && k.includes(lower));
      if (matches && cats.includes(worksite.category)) {
        score += 2;
        const reason = `IT interest: "${interest}"`;
        if (!seenItReasons.has(reason)) {
          reasons.push(reason);
          seenItReasons.add(reason);
        }
      }
    }
  }

  // 3) Specific-interests free-text -> worksite tag overlap.
  if (intern.specificInterests) {
    const specLower = intern.specificInterests.toLowerCase();
    for (const tag of worksite.tags || []) {
      if (specLower.includes(tag.toLowerCase())) {
        score += 2;
        reasons.push(`Mentioned "${tag}" in specific interests`);
      }
    }
  }

  // 4) Programs: robotics/FRC/FTC bonus for Engineering/Manufacturing.
  const meaningfulPrograms = (intern.programs || []).filter(p => p && p !== 'Not Applicable/None');
  if (meaningfulPrograms.length > 0 &&
      (worksite.category === 'Engineering' || worksite.category === 'Manufacturing')) {
    const hasRobotics = meaningfulPrograms.some(p => {
      const pl = p.toLowerCase();
      return pl.includes('robot') || pl.includes('frc') || pl.includes('ftc');
    });
    if (hasRobotics) {
      score += 1;
      reasons.push('Robotics / engineering program experience');
    }
  }

  // 5) CS course bonus for Tech / Design worksites.
  const csVal = (intern.csCourseTaken || '').toLowerCase();
  if ((csVal === 'yes' || csVal.includes('currently')) &&
      (worksite.category === 'Technology / IT' || worksite.category === 'Design / Creative')) {
    score += 1;
    reasons.push('CS / IT coursework');
  }

  // 6) Capacity penalty.
  if (opts.enforceCapacity && worksite.filled >= worksite.capacity) {
    score -= 5;
  }

  // Dedupe reasons preserving order.
  const seen = new Set<string>();
  const uniqueReasons = reasons.filter(r => {
    if (seen.has(r)) return false;
    seen.add(r);
    return true;
  });

  return { score, reasons: uniqueReasons };
}

export interface RankOptions {
  excludeAssignedHere?: boolean;
  excludeAssignedAnywhere?: boolean;
  minScore?: number;
  newestOnly?: boolean;
  enforceCapacity?: boolean;
}

export function rankInternsForWorksite(
  worksite: Worksite,
  interns: Intern[],
  assignments: Assignment[],
  opts: RankOptions = {},
): InternMatch[] {
  const {
    excludeAssignedHere = true,
    excludeAssignedAnywhere = true,
    minScore = -Infinity,
    newestOnly = true,
    enforceCapacity = true,
  } = opts;

  const assignedAnywhere = new Set(assignments.map(a => a.internId));
  const assignedHere = new Set(
    assignments.filter(a => a.worksiteId === worksite.id).map(a => a.internId),
  );

  const matches: InternMatch[] = [];
  for (const intern of interns) {
    if (newestOnly && !intern.isNewest) continue;
    const here = assignedHere.has(intern.id);
    const elsewhere = !here && assignedAnywhere.has(intern.id);
    if (excludeAssignedHere && here) continue;
    if (excludeAssignedAnywhere && elsewhere) continue;

    const { score, reasons } = scoreInternWorksite(intern, worksite, { enforceCapacity });
    if (score < minScore) continue;

    matches.push({ intern, score, reasons, alreadyAssignedHere: here, alreadyAssignedElsewhere: elsewhere });
  }

  matches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.intern.lastName || '').localeCompare(b.intern.lastName || '');
  });

  return matches;
}
