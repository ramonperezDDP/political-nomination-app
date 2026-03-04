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

  // Calculate score based on:
  // 1. Issue overlap ratio (what % of user's issues does candidate prioritize)
  const overlapRatio = matchedIssues.length / userIssues.length;

  // 2. Priority alignment (are matched issues high priority for candidate?)
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

  // Base score calculation:
  // - 20 base points
  // - Up to 50 points for overlap ratio
  // - Up to 30 points from priority bonus (capped)
  const overlapScore = overlapRatio * 50;
  const cappedPriorityBonus = Math.min(priorityBonus, 30);
  const baseScore = Math.round(20 + overlapScore + cappedPriorityBonus);

  return {
    score: Math.min(100, Math.max(0, baseScore)),
    matchedIssues,
    hasDealbreaker,
    matchedDealbreakers,
  };
}
