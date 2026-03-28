# PLAN-00 Phase 2: Round-Scoped Endorsements, Bookmarks, and Candidate Elimination

> **Status:** Ready for review.
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

## Data Model Changes

### Endorsement (existing, modified)

Currently endorsements are stored as a subcollection `users/{userId}/endorsements/{candidateId}`. Add round scoping:

```ts
interface Endorsement {
  candidateId: string;
  roundId: string;       // NEW: which round this endorsement was made in
  endorsedAt: Timestamp;
}
```

### Bookmark (new)

Store as a subcollection `users/{userId}/bookmarks/{candidateId}`:

```ts
interface Bookmark {
  candidateId: string;
  convertedFromRoundId?: string;  // which round's endorsement this came from (null if manually bookmarked)
  bookmarkedAt: Timestamp;
}
```

### Candidate — `contestStatus` (new field)

Add to `Candidate` type:

```ts
contestStatus: 'active' | 'eliminated';
```

Set by the round advancement cron after evaluating endorsement counts against the round's threshold.

## Implementation

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
- `addBookmark(userId, candidateId, fromRoundId?)` — create bookmark document
- `removeBookmark(userId, candidateId)` — delete bookmark document
- `getBookmarks(userId)` → `Bookmark[]`
- `convertEndorsementsToBookmarks(userId, roundId)` — batch: create bookmarks from endorsements, delete endorsements
- `eliminateCandidates(roundId, threshold)` — mark candidates below threshold as `contestStatus: 'eliminated'`

**Modified functions:**
- `endorseCandidate` → include `roundId` in endorsement document
- `getEndorsementLeaderboard` → only count endorsements for current round
- `getCandidatesForFeed` → filter out eliminated candidates

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

1. **Eliminate candidates** below the outgoing round's endorsement threshold
2. **Convert all endorsements to bookmarks** for all users
3. **Reset endorsement counts** on candidate documents for the new round (or keep cumulative and track per-round separately)

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
