/**
 * Per-round candidate field sizes.
 *
 * Round 1 (Endorsement One) is unconstrained — every approved candidate in
 * the district is visible and endorsable. Later rounds narrow the field:
 *
 *   Endorsement One   →  all approved candidates
 *   Endorsement Two   →  top 20 (by endorsement count from Round 1)
 *   Endorsement Three →  top 10 (by endorsement count from Round 2)
 *   Virtual Town Hall →  top 10 (same pool as Round 3, now presenting)
 *   Debate            →  top  4 (advanced from VTH)
 *   Final Results     →  top  2 (debate finalists)
 *   Post-Election     →  top  1 (winner)
 *
 * These are the advancement counts derived from the CSV simulation data.
 * Returning `undefined` means "no cap" — caller should fetch everything.
 *
 * If/when the thresholds change, update this table (or move it to a
 * Firestore config doc if they need to be tunable at runtime).
 */

import type { ContestRoundId } from '@/types';

const ROUND_CANDIDATE_LIMITS: Record<ContestRoundId, number | undefined> = {
  round_1_endorsement: undefined, // unlimited — every approved candidate
  round_2_endorsement: 20,
  round_3_endorsement: 10,
  virtual_town_hall: 10,
  debate: 4,
  final_results: 2,
  post_election: 1,
};

/**
 * How many candidates should be visible in this round's feed / leaderboard?
 * Returns `undefined` for unlimited.
 */
export function getRoundCandidateLimit(
  roundId: ContestRoundId | undefined | null
): number | undefined {
  if (!roundId) return undefined;
  return ROUND_CANDIDATE_LIMITS[roundId];
}
