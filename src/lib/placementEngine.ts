import type { Intern, Placement, Worksite, InterestField } from '@/types/intern';
import { INTEREST_LABELS } from '@/types/intern';

interface ScoredPlacement {
  worksite: Worksite;
  score: number;
  reasons: string[];
}

const INTEREST_TO_WORKSITE: Record<InterestField, string[]> = {
  clevelandClinic: ['Cleveland Clinic'],
  constructionMgmt: ['Construction Management Program'],
  biomedical: ['Biomedical Science & Engineering Lab'],
  envJustice: ['Environmental Justice Initiative'],
  envClimate: ['Climate Adaptation & Resilience Program'],
  envFieldScience: ['Field Science & Data Analytics'],
  iersCenter: ['CSU IERS Center'],
  magnetManufacturing: ["MAGNET Summer Manufacturing Academy"],
  educationInternship: ['STEM Education Internship'],
  healthcare: ['Healthcare Careers Program', 'Cleveland Clinic'],
  videoGames: ['Game & App Design Studio'],
};

const IT_INTEREST_TO_CATEGORY: Record<string, string[]> = {
  'working at an it help desk': ['Technology / IT'],
  'data science': ['Technology / IT', 'Research'],
  'building prostethic hands': ['Engineering', 'Healthcare'],
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

function scoreInterestField(intern: Intern, field: InterestField): number {
  const val = intern[field];
  if (val === 'Yes') return 3;
  if (val === 'Maybe') return 1;
  return 0;
}

export function generatePlacements(intern: Intern, worksites: Worksite[]): Placement[] {
  const scored: ScoredPlacement[] = [];

  for (const ws of worksites) {
    let score = 0;
    const reasons: string[] = [];

    // Score from direct interest fields
    for (const [field, wsNames] of Object.entries(INTEREST_TO_WORKSITE)) {
      if (wsNames.some(n => ws.name.toLowerCase().includes(n.toLowerCase().slice(0, 15)))) {
        const s = scoreInterestField(intern, field as InterestField);
        if (s > 0) {
          score += s * 2;
          const label = INTEREST_LABELS[field as InterestField];
          reasons.push(`${s === 6 ? 'Strong' : s === 2 ? 'Some' : 'Strong'} interest in ${label}`);
        }
      }
    }

    // Score from IT interests matching worksite category
    for (const interest of intern.itInterests) {
      const lower = interest.toLowerCase();
      for (const [key, cats] of Object.entries(IT_INTEREST_TO_CATEGORY)) {
        if (lower.includes(key) || key.includes(lower.slice(0, 10))) {
          if (cats.includes(ws.category)) {
            score += 2;
            reasons.push(`IT interest in "${interest}" aligns with ${ws.category}`);
          }
        }
      }
    }

    // Score from specific interests text
    if (intern.specificInterests) {
      const specLower = intern.specificInterests.toLowerCase();
      for (const tag of ws.tags) {
        if (specLower.includes(tag.toLowerCase())) {
          score += 2;
          reasons.push(`Mentioned "${tag}" in specific interests`);
        }
      }
    }

    // Score from prior programs
    if (intern.programs.length > 0 && intern.programs[0] !== 'Not Applicable/None') {
      if (ws.category === 'Engineering' || ws.category === 'Manufacturing') {
        const hasRobotics = intern.programs.some(p => p.toLowerCase().includes('robot') || p.toLowerCase().includes('frc') || p.toLowerCase().includes('ftc'));
        if (hasRobotics) {
          score += 1;
          reasons.push('Has robotics/engineering program experience');
        }
      }
    }

    // CS course bonus
    if ((intern.csCourseTaken === 'Yes' || intern.csCourseTaken?.toLowerCase().includes('currently')) && 
        (ws.category === 'Technology / IT' || ws.category === 'Design / Creative')) {
      score += 1;
      reasons.push('Has CS/IT coursework experience');
    }

    // Capacity penalty
    if (ws.filled >= ws.capacity) {
      score -= 5;
      reasons.push('(At capacity)');
    }

    if (score > 0) {
      // Deduplicate reasons
      const uniqueReasons = [...new Set(reasons)];
      scored.push({ worksite: ws, score, reasons: uniqueReasons.slice(0, 3) });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, 3).map((s, i) => ({
    priority: (i + 1) as 1 | 2 | 3,
    worksiteId: s.worksite.id,
    worksiteName: s.worksite.name,
    category: s.worksite.category,
    reasoning: s.reasons.join('. ') + '.',
  }));
}
