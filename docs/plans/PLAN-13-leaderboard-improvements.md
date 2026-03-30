# PLAN-13: Leaderboard Improvements — SPLIT INTO 13A + 13B

> **Status:** 13A complete (hide cutoff on trending). 13B partially complete (MassEndorseButton client-side working; server-side batch endpoint deferred to production).

## PLAN-13A: Hide Cutoff Line on Trending Tab ✅ COMPLETE (2026-03-27)

**File:** `app/(main)/(leaderboard)/index.tsx` (post-PLAN-17 location)

The endorsement threshold cutoff line was showing on BOTH the Endorsements and Trending tabs. Fixed to only show on Endorsements.

**Change:** Added `leaderboardType === 'endorsements'` guard to `showCutoffLine` in `renderCandidateTile`. The below-cutoff dim styling was already correctly gated.

**Testing:** Verified 2026-03-27 — Endorsements tab shows cutoff line + dimmed candidates; Trending tab shows no cutoff line, no dimming.

---

## PLAN-13B: Mass Endorse — 🟡 PARTIALLY UNBLOCKED

> **Updated 2026-03-28:** Issue filtering deferred. Mass endorse stays client-side for beta (no Cloud Function needed). Blocked on PLAN-00 Phase 2 (round-scoped endorsements) which is now written and ready for review.

**Do NOT implement the code examples from the original plan.** They contain:
- Client-side sequential `for (...) await endorseCandidate()` loop (will partially succeed, create race conditions)
- Biometric-only authorization (bypasses real eligibility checks)
- `isEliminated` references (stale — system uses `contestStatus`)

**Before this can be implemented:**
1. Build a `batchEndorse` callable Cloud Function that validates eligibility server-side
2. Decide issue filter source: user's quiz issues, all available issues, or both
3. PLAN-00 Phase 2 must land (round-scoped endorsement counts, `contestStatus` filtering)
4. Mass-endorse eligibility: `selectCanEndorseCandidate` is the **client-side mirror** of the rule (for UX gating). The **server-side `batchEndorse` Cloud Function** is the source of truth — it must independently validate eligibility for every candidate in the batch. The client selector is not sufficient validation for the batch action.

**Data enrichment will be required:** Candidate issue metadata is needed for filtering, but the exact shape depends on the final filter model decision (user quiz issues, all issues, both, or precomputed match data). Do not assume `topIssueIds: string[]` until the product decision is final.

> **Depends on:** [PLAN-00 Phase 2](./PLAN-00-contest-round-architecture.md), backend batch endpoint, filter model product decision
