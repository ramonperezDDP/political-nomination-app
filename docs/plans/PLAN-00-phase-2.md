# PLAN-00 Phase 2: Round-Scoped Endorsements, Bookmarks, and Candidate Elimination

> **Status:** ✅ Implemented (2026-03-28/29). Round-scoped endorsements, bookmarks, elimination, Cloud Function.
>
> **Depends on:** PLAN-00 Phase 1 (complete), PLAN-10 (complete)
>
> **Unblocks:** PLAN-12 (bookmarks), PLAN-13B (mass endorse), PLAN-14B (endorsements page redesign)

## Summary

Implement round-scoped endorsements with automatic conversion to bookmarks at round boundaries, candidate elimination based on endorsement thresholds, and the bookmarks system. Daily round advancement (already exists in Cloud Functions) triggers endorsement→bookmark conversion.

## Key Decisions (confirmed 2026-03-28)

1. **Endorsements reset per round, converted to bookmarks.** When a round advances, all endorsements become bookmarks. Users must actively re-endorse in each new round. Bookmarks persist across rounds to make re-endorsement easy.

2. **Eliminated candidates:**
   - **For You feed:** Removed entirely (not shown)
   - **Leaderboard Endorsements tab:** Greyed out below the threshold line (still accessible via tap)
   - **Leaderboard Trending tab:** Removed entirely
   - **Candidate profile page:** Still accessible from the leaderboard

3. **Bookmarks** are surfaced only on the Profile's "My Endorsements & Bookmarks" page with two tabs (Endorsements / Bookmarks).

4. **Round advancement:** Daily cron (existing `advanceContestRoundDaily`), auto-cycles through all rounds in beta_demo mode. Cron also converts endorsements → bookmarks on each advance.

5. **Mass endorse:** Client-side for beta (no Cloud Function batch endpoint needed). Server-side hardening deferred to production.

## PM Review Findings (2026-03-28)

Reviewed by OpenAI PM Review MCP. Key revisions incorporated below:

1. **Document ID collision (HIGH):** Changed endorsement doc ID from `{candidateId}` to `{roundId}_{candidateId}` so endorsements for the same candidate across different rounds don't collide.
2. **Scalability (HIGH):** Conversion function now uses paged batching with 500-doc batch limit. For beta scale this is sufficient; Cloud Tasks sharding documented for production.
3. **Migration (MEDIUM):** Added Step 0 — migration script to backfill `roundId` on existing endorsements.
4. **Race condition (MEDIUM):** Conversion is idempotent — checks for existing bookmark before creating, skips already-converted docs. Cron sets a `roundTransitionInProgress` flag to prevent new endorsements during transition.
5. **Threshold config (MEDIUM):** Endorsement threshold stored per-round in `contestRounds/{roundId}.eliminationThreshold`. Surfaced to client via existing config store round data.

## Data Model Changes

### Endorsement (existing, modified)

Endorsements stored as subcollection `users/{userId}/endorsements/{roundId}_{candidateId}`. **Document ID is `{roundId}_{candidateId}`** to allow the same candidate to be endorsed in multiple rounds without collision.

```ts
interface Endorsement {
  candidateId: string;
  roundId: string;       // which round this endorsement was made in
  endorsedAt: Timestamp;
}
```

### Bookmark (new)

Store as subcollection `users/{userId}/bookmarks/{candidateId}`. Document ID is `{candidateId}` — bookmarks are not round-scoped; re-bookmarking the same candidate updates the existing doc.

```ts
interface Bookmark {
  candidateId: string;
  convertedFromRoundId?: string;  // which round's endorsement this came from (undefined if manually bookmarked)
  bookmarkedAt: Timestamp;
}
```

### Candidate — `contestStatus` (new field)

Add to `Candidate` type:

```ts
contestStatus: 'active' | 'eliminated';
```

Set by the round advancement cron after evaluating endorsement counts against the round's `eliminationThreshold`.

### ContestRound — `eliminationThreshold` (new field)

Add to `ContestRound` type:

```ts
eliminationThreshold?: number;  // minimum endorsement count to survive this round
```

Stored in `contestRounds/{roundId}` Firestore documents. Surfaced to client for the cutoff line on the leaderboard.

## Implementation

### 0. Migration Script (`scripts/migrateEndorsements.ts`)

Backfill `roundId` on existing endorsements and re-key documents from `{candidateId}` to `{roundId}_{candidateId}`:

- Query all `users/{uid}/endorsements` documents missing `roundId`
- Set `roundId` to the current `currentRoundId` from contest config
- Re-create each doc with the new `{roundId}_{candidateId}` key, delete the old `{candidateId}` key
- Run as a one-time script via `npx ts-node scripts/migrateEndorsements.ts`
- Idempotent: skips docs that already have the correct key format

### 1. Types (`src/types/index.ts` and `index.web.ts`)

- Add `roundId: string` to endorsement type
- Add `Bookmark` interface
- Add `contestStatus: 'active' | 'eliminated'` to `Candidate`

### 2. User Store (`src/stores/userStore.ts`)

**Endorsement changes:**
- `endorseCandidate(userId, candidateId)` → add current `roundId` to the endorsement
- `fetchEndorsements(userId)` → filter to current round's endorsements only
- Add `fetchBookmarks(userId)` action
- Add `bookmarkCandidate(userId, candidateId)` and `removeBookmark(userId, candidateId)` actions
- Add `convertEndorsementsToBookmarks(userId, fromRoundId)` — moves all endorsements from a round to bookmarks

**Selectors:**
- `selectCurrentRoundEndorsements` — endorsements for current round only
- `selectBookmarks` — all bookmarks
- `selectHasBookmarkedCandidate(candidateId)` — check if bookmarked

### 3. Firestore Functions (`src/services/firebase/firestore.ts` and `firestore.web.ts`)

**New functions:**
- `addBookmark(userId, candidateId, fromRoundId?)` — create bookmark doc at `bookmarks/{candidateId}`
- `removeBookmark(userId, candidateId)` — delete bookmark document
- `getBookmarks(userId)` → `Bookmark[]`
- `convertEndorsementsToBookmarks(userId, roundId)` — paged batch (≤500 writes per batch): for each endorsement with matching `roundId`, check if bookmark already exists (idempotent), create bookmark if not, delete endorsement. Returns count of converted docs.
- `eliminateCandidates(roundId, threshold)` — query candidates with endorsement count < threshold, set `contestStatus: 'eliminated'` in batches of 500

**Modified functions:**
- `endorseCandidate` → write to doc ID `{roundId}_{candidateId}`, include `roundId` field
- `getEndorsementLeaderboard` → only count endorsements where `roundId` matches current round
- `getCandidatesForFeed` → filter out candidates where `contestStatus === 'eliminated'`

### 4. Feed (`app/(main)/(feed)/index.tsx`)

- Filter out candidates where `contestStatus === 'eliminated'`
- This applies to both "My Issues" and "My Area" filters

### 5. Leaderboard (`app/(main)/(leaderboard)/index.tsx`)

**Endorsements tab:**
- Show all candidates (including eliminated)
- Eliminated candidates greyed out below the threshold line (already partially implemented via `belowCutoff` styling)
- Add `contestStatus` check to the dim styling

**Trending tab:**
- Filter out eliminated candidates entirely

### 6. Endorsements & Bookmarks Page (`app/(main)/(profile)/endorsements.tsx`)

Redesign with two tabs:

**Endorsements tab:**
- Shows current round's endorsements only
- Each card: candidate avatar, name, alignment score, "Endorsed" badge
- If round has no endorsements: "You haven't endorsed anyone this round yet"

**Bookmarks tab:**
- Shows all bookmarks (from previous round conversions + manual adds)
- Each card: candidate avatar, name, alignment score
- "Re-endorse" button on each card (endorses for current round and removes bookmark)
- "Remove" button to delete bookmark
- If eliminated: show greyed out with "Eliminated" label, no re-endorse button

### 7. For You Feed — Bookmark Action

- Add a bookmark icon to the FullScreenPSA action buttons (alongside endorse, share)
- Tap to bookmark/unbookmark
- Visual: outline bookmark icon (not bookmarked) / filled bookmark icon (bookmarked)

### 8. Cloud Function — Round Advancement (`functions/src/cron/advanceContestRound.ts`)

The existing cron already advances `currentRoundId` daily. Add:

1. **Set `roundTransitionInProgress: true`** on contest config (prevents client-side endorsements during transition)
2. **Eliminate candidates** below the outgoing round's `eliminationThreshold`
3. **Convert all endorsements to bookmarks** for all users — paged: query users with endorsements for outgoing round, process in batches. Each conversion is idempotent (check-before-write).
4. **Advance `currentRoundId`** to next round
5. **Set `roundTransitionInProgress: false`**
6. **Reset per-round endorsement counts** on candidate documents (new round starts at 0)

**Idempotency:** If the function retries (e.g., timeout), it checks `roundTransitionInProgress` and the current round ID to determine where to resume. Already-converted endorsements are skipped (bookmark exists check).

**Scale notes:** For beta (~100 users, ~50 candidates), single function execution is sufficient. For production (>10K users), refactor to fan-out via Cloud Tasks — one task per user batch.

### 9. Config Store

- Add `contestStatus` to candidate data flowing through the app
- When round changes, trigger re-fetch of candidate data (to pick up elimination status)

## Round Lifecycle

```
Round N active:
  - Users endorse candidates
  - Endorsement counts accumulate
  - Leaderboard reflects current round endorsements

Round N → N+1 transition (daily cron):
  1. Evaluate endorsement threshold for Round N
  2. Mark candidates below threshold as eliminated
  3. Convert all Round N endorsements to bookmarks for each user
  4. Advance currentRoundId to Round N+1
  5. New round begins — endorsement counts start at 0

Round N+1 active:
  - Users see bookmarks from Round N
  - "Re-endorse" prompt encourages rolling over favorites
  - Eliminated candidates hidden from feed and trending
  - Eliminated candidates greyed out on endorsement leaderboard
```

## Beta Demo Behavior

In `beta_demo` mode:
- Rounds auto-cycle daily (already implemented)
- After `final_results`, cycles back to `pre_nomination`
- Endorsements convert to bookmarks at each cycle
- Elimination thresholds are evaluated but candidates can be "un-eliminated" when the cycle resets to `pre_nomination` (all candidates reset to `active`)

## Testing

- [ ] Endorsing a candidate stores the current roundId
- [ ] Endorsement counts on leaderboard reflect current round only
- [ ] Round advance converts all endorsements to bookmarks
- [ ] Bookmarks persist across rounds
- [ ] Bookmarks page shows two tabs (Endorsements / Bookmarks)
- [ ] "Re-endorse" from bookmarks creates new endorsement + removes bookmark
- [ ] Eliminated candidates hidden from For You feed
- [ ] Eliminated candidates greyed out on Endorsements leaderboard tab
- [ ] Eliminated candidates hidden from Trending leaderboard tab
- [ ] Eliminated candidate profile still accessible from leaderboard
- [ ] Bookmark icon on For You cards works (add/remove)
- [ ] Beta demo: cycle resets eliminated candidates to active
- [ ] Mass endorse (client-side) works with round-scoped endorsements
