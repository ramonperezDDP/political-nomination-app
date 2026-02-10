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
}

export interface AlignmentResult {
  score: number;
  matchedIssues: string[];
  hasDealbreaker: boolean;
}

export function calculateAlignmentScore({
  candidateIssues = [],
  userIssues = [],
  candidatePositions = [],
  userDealbreakers = [],
}: AlignmentInput): AlignmentResult {
  // Find issues that both user and candidate prioritize
  const matchedIssues = candidateIssues.filter((id) => userIssues.includes(id));

  // Check for dealbreakers (issues where candidate has extreme opposite position)
  const hasDealbreaker = userDealbreakers.some((dealbreaker) => {
    const position = candidatePositions.find((p) => p.issueId === dealbreaker);
    return position && Math.abs(position.spectrumPosition) > 80;
  });

  // If user has no selected issues, return neutral score
  if (userIssues.length === 0) {
    return { score: 50, matchedIssues: [], hasDealbreaker };
  }

  // If candidate has no priority issues, return low score
  if (candidateIssues.length === 0) {
    return { score: 30, matchedIssues: [], hasDealbreaker };
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
  };
}
