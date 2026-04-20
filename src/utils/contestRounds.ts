/**
 * Per-round candidate field sizes.
 *
 * Round 1 (Endorsement One) is unconstrained — every approved candidate in
 * the district is visible and endorsable. Later rounds narrow the field
 * per the contest progression:
 *
 *   Endorsement One   →  all approved candidates
 *                        ↓ top 20 advance
 *   Endorsement Two   →  top 20
 *                        ↓ top 10 advance
 *   Endorsement Three →  top 10
 *                        ↓ top  4 advance
 *   Virtual Town Hall →  top  4
 *                        ↓ top  2 advance
 *   Debate            →  top  2
 *                        ↓ winner announced
 *   Final Results     →  top  1 (winner)
 *   Post-Election     →  top  1 (same winner, archived state)
 *
 * Returning `undefined` means "no cap" — caller fetches everything.
 *
 * If/when the thresholds change, update this table (or move it to a
 * Firestore config doc if they need to be tunable at runtime).
 */

import type { ContestRoundId } from '@/types';

const ROUND_CANDIDATE_LIMITS: Record<ContestRoundId, number | undefined> = {
  round_1_endorsement: undefined, // unlimited — every approved candidate
  round_2_endorsement: 20,
  round_3_endorsement: 10,
  virtual_town_hall: 4,
  debate: 2,
  final_results: 1,
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
