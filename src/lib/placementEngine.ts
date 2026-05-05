import type { Intern, Placement, Worksite } from '@/types/intern';
import { scoreInternWorksite } from '@/lib/worksiteMatcher';

/**
 * For a given intern, return their top 3 suggested worksites.
 *
 * This delegates scoring to `worksiteMatcher.scoreInternWorksite` so
 * both directions (intern -> top worksites, worksite -> ranked interns)
 * use the same data-driven heuristics. Adding/renaming/repurposing a
 * worksite is a UI edit; no code changes required.
 */
export function generatePlacements(intern: Intern, worksites: Worksite[]): Placement[] {
  type Scored = { worksite: Worksite; score: number; reasons: string[] };
  const scored: Scored[] = [];

  for (const ws of worksites) {
    const { score, reasons } = scoreInternWorksite(intern, ws, { enforceCapacity: true });
    if (score > 0) {
      scored.push({ worksite: ws, score, reasons: reasons.slice(0, 3) });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, 3).map((s, i) => ({
    priority: (i + 1) as 1 | 2 | 3,
    worksiteId: s.worksite.id,
    worksiteName: s.worksite.name,
    category: s.worksite.category,
    reasoning: s.reasons.join('. ') + (s.reasons.length ? '.' : ''),
  }));
}
