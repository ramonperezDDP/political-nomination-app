/**
 * Shared alignment score calculation.
 *
 * This is the single source of truth for computing how well a candidate
 * matches a voter's priorities. Used by the For You feed AND the candidate
 * profile page so the numbers are always consistent.
 */

export interface AlignmentInput {
  candidateIssues: string[];
  userIssues: string[];
  candidatePositions: Array<{ issueId: string; spectrumPosition: number; priority: number }>;
  userDealbreakers: string[];
  /** All candidate positions (including non-priority) for dealbreaker checking */
  allCandidatePositions?: Array<{ issueId: string; spectrumPosition: number; priority: number }>;
  /** User's quiz responses — used to compare spectrum positions with candidates */
  userResponses?: Array<{ issueId: string; answer: string | number | string[] }>;
}

export interface AlignmentResult {
  score: number | null;
  matchedIssues: string[];
  hasDealbreaker: boolean;
  matchedDealbreakers: string[];
}

// Map dealbreaker option IDs to candidate issue IDs + spectrum direction.
// Negative spectrum = progressive stance, positive = conservative stance.
// A dealbreaker triggers when the candidate's position is strongly in the
// specified direction (e.g., 'gun_control' dealbreaker triggers on candidates
// with a strong progressive gun-policy stance, spectrum < -60).
export const DEALBREAKER_MAP: Record<string, { issueId: string; direction: 'negative' | 'positive' }> = {
  'abortion_access':          { issueId: 'abortion', direction: 'negative' },
  'abortion_restrictions':    { issueId: 'abortion', direction: 'positive' },
  'gun_control':              { issueId: 'gun-policy', direction: 'negative' },
  'gun_rights':               { issueId: 'gun-policy', direction: 'positive' },
  'climate_action':           { issueId: 'climate-change', direction: 'negative' },
  'fossil_fuels':             { issueId: 'climate-change', direction: 'positive' },
  'immigration_restrictive':  { issueId: 'immigration', direction: 'positive' },
  'immigration_permissive':   { issueId: 'immigration', direction: 'negative' },
  'universal_healthcare':     { issueId: 'healthcare', direction: 'negative' },
  'private_healthcare':       { issueId: 'healthcare', direction: 'positive' },
  'lgbtq_rights':             { issueId: 'lgbtq-rights', direction: 'negative' },
  'religious_liberty':        { issueId: 'lgbtq-rights', direction: 'positive' },
};

export function calculateAlignmentScore({
  candidateIssues = [],
  userIssues = [],
  candidatePositions = [],
  userDealbreakers = [],
  allCandidatePositions,
  userResponses = [],
}: AlignmentInput): AlignmentResult {
  // Find issues that both user and candidate prioritize
  const matchedIssues = candidateIssues.filter((id) => userIssues.includes(id));

  // Use all positions for dealbreaker checking (falls back to candidatePositions)
  const positionsForDealbreakers = allCandidatePositions || candidatePositions;

  // Check for dealbreakers using the stance-to-issue mapping
  const matchedDealbreakers = userDealbreakers.filter((dealbreaker) => {
    const mapping = DEALBREAKER_MAP[dealbreaker];
    if (!mapping) return false;
    const position = positionsForDealbreakers.find((p) => p.issueId === mapping.issueId);
    if (!position) return false;
    // Trigger if candidate holds a strong position in the dealbreaker direction
    if (mapping.direction === 'negative') {
      return position.spectrumPosition < -60;
    }
    return position.spectrumPosition > 60;
  });
  const hasDealbreaker = matchedDealbreakers.length > 0;

  // If user has no selected issues, score is unknown
  if (userIssues.length === 0) {
    return { score: null, matchedIssues: [], hasDealbreaker, matchedDealbreakers };
  }

  // If candidate has no priority issues, return low score
  if (candidateIssues.length === 0) {
    return { score: 30, matchedIssues: [], hasDealbreaker, matchedDealbreakers };
  }

  // 1. Issue overlap ratio (what % of user's issues does candidate prioritize)
  const overlapRatio = matchedIssues.length / userIssues.length;

  // 2. Spectrum alignment — compare user's quiz answers with candidate positions
  //    For each matched issue where the user has an answer, compute closeness (0–1).
  //    Distance is |userAnswer - candidatePosition| on a -100..100 scale (max 200).
  let spectrumTotal = 0;
  let spectrumCount = 0;
  if (userResponses.length > 0) {
    const responseMap = new Map<string, number>();
    for (const r of userResponses) {
      const val = Number(r.answer);
      if (!isNaN(val)) responseMap.set(r.issueId, val);
    }

    // Compare against ALL candidate positions (not just matched issues)
    const allPositions = allCandidatePositions || candidatePositions;
    for (const pos of allPositions) {
      const userVal = responseMap.get(pos.issueId);
      if (userVal === undefined) continue;
      const distance = Math.abs(userVal - pos.spectrumPosition) / 200; // 0–1
      spectrumTotal += 1 - distance; // closeness: 1 = identical, 0 = opposite
      spectrumCount++;
    }
  }
  const spectrumAlignment = spectrumCount > 0 ? spectrumTotal / spectrumCount : 0.5;

  // 3. Priority alignment (are matched issues high priority for candidate?)
  let priorityBonus = 0;
  matchedIssues.forEach((issueId) => {
    const candidatePosition = candidatePositions.find((p) => p.issueId === issueId);
    if (candidatePosition) {
      if (candidatePosition.priority <= 3) {
        priorityBonus += 10;
      } else if (candidatePosition.priority <= 5) {
        priorityBonus += 5;
      }
    }
  });

  // Score calculation:
  // - 10 base points
  // - Up to 30 points for issue overlap
  // - Up to 40 points for spectrum alignment (policy position closeness)
  // - Up to 20 points from priority bonus (capped)
  const overlapScore = overlapRatio * 30;
  const spectrumScore = spectrumAlignment * 40;
  const cappedPriorityBonus = Math.min(priorityBonus, 20);
  const baseScore = Math.round(10 + overlapScore + spectrumScore + cappedPriorityBonus);

  return {
    score: Math.min(100, Math.max(0, baseScore)),
    matchedIssues,
    hasDealbreaker,
    matchedDealbreakers,
  };
}
