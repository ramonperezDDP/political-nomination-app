/**
 * Shared alignment score calculation.
 *
 * This is the single source of truth for computing how well a candidate
 * matches a voter based on quiz answer spectrum closeness.
 * Used by the For You feed AND the candidate profile page so the numbers
 * are always consistent.
 *
 * PLAN-10E: Pure quiz-based matching. No priority issues, no overlap ratio,
 * no priority bonus, no base points.
 */

export interface AlignmentInput {
  candidateResponses: Array<{ questionId: string; issueId: string; answer: number }>;
  userResponses: Array<{ questionId: string; issueId: string; answer: number }>;
}

export interface AlignmentResult {
  score: number | null;              // 0-100, null if no shared answers
  sharedCount: number;               // how many questions both answered
  exactMatchIds: string[];           // questionIds where closeness >= 0.75 (same answer)
  closeMatchIds: string[];           // questionIds where closeness 0.25–0.74 (adjacent answer)
  notMatchedIds: string[];           // questionIds where closeness < 0.25 (opposite answer)
  // Legacy alias for feed chips (exact matches)
  alignedQuestionIds: string[];
}

export function calculateAlignmentScore({
  candidateResponses = [],
  userResponses = [],
}: AlignmentInput): AlignmentResult {
  // Build lookup from questionId -> numeric answer for the candidate
  const candidateMap = new Map<string, number>();
  for (const r of candidateResponses) {
    const val = Number(r.answer);
    if (!isNaN(val)) candidateMap.set(r.questionId, val);
  }

  // Compare each user response against the candidate's answer for the same questionId
  let closenessTotal = 0;
  let sharedCount = 0;
  const exactMatchIds: string[] = [];
  const closeMatchIds: string[] = [];
  const notMatchedIds: string[] = [];

  for (const ur of userResponses) {
    const userVal = Number(ur.answer);
    if (isNaN(userVal)) continue;

    const candidateVal = candidateMap.get(ur.questionId);
    if (candidateVal === undefined) continue;

    // Both answered this question
    // Max possible difference is 160 (from -80 to +80), not 200
    const closeness = Math.max(0, 1 - Math.abs(userVal - candidateVal) / 160);
    closenessTotal += closeness;
    sharedCount++;

    // Thresholds aligned to 3 quiz options (-80/0/80):
    // exact: diff=0 → 1.0, close: diff=80 → 0.5, mismatch: diff=160 → 0.0
    if (closeness >= 0.75) {
      exactMatchIds.push(ur.questionId);
    } else if (closeness >= 0.25) {
      closeMatchIds.push(ur.questionId);
    } else {
      notMatchedIds.push(ur.questionId);
    }
  }

  if (sharedCount === 0) {
    return { score: null, sharedCount: 0, exactMatchIds: [], closeMatchIds: [], notMatchedIds: [], alignedQuestionIds: [] };
  }

  const score = Math.round((closenessTotal / sharedCount) * 100);

  return {
    score: Math.min(100, Math.max(0, score)),
    sharedCount,
    exactMatchIds,
    closeMatchIds,
    notMatchedIds,
    alignedQuestionIds: exactMatchIds,
  };
}
