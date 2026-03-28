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
  /** All candidate positions for spectrum comparison */
  allCandidatePositions?: Array<{ issueId: string; spectrumPosition: number; priority: number }>;
  /** User's quiz responses — used to compare spectrum positions with candidates */
  userResponses?: Array<{ issueId: string; answer: string | number | string[] }>;
}

export interface AlignmentResult {
  score: number | null;
  matchedIssues: string[];
}

export function calculateAlignmentScore({
  candidateIssues = [],
  userIssues = [],
  candidatePositions = [],
  allCandidatePositions,
  userResponses = [],
}: AlignmentInput): AlignmentResult {
  // Find issues that both user and candidate prioritize
  const matchedIssues = candidateIssues.filter((id) => userIssues.includes(id));

  // If user has no selected issues, score is unknown
  if (userIssues.length === 0) {
    return { score: null, matchedIssues: [] };
  }

  // If candidate has no priority issues, return low score
  if (candidateIssues.length === 0) {
    return { score: 30, matchedIssues: [] };
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
  };
}
