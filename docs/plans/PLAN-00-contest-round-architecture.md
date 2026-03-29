# PLAN-00: Contest Round Architecture (Foundation)

> **Phase 1: ✅ COMPLETE.** Contest rounds, configStore, selectors, timeline display.
> **Phase 2: Ready for review** — see [PLAN-00-phase-2.md](./PLAN-00-phase-2.md) for round-scoped endorsements, bookmarks, and candidate elimination.

## Summary

This is the foundational plan that defines the **contest round** state model. Every other plan that references contest rounds, FAQs, candidate elimination, voting methods, or round-specific UI behavior depends on this architecture.

The contest round is a **global, shared state** — all users see the same round at the same time, regardless of when they signed up. A user who joins on day 5 enters whatever round is active on that day.

## Design Goals

1. **Content-driven today:** Initially, the round state drives text content (FAQs, explainers, About the Contest timeline, section labels).
2. **Elimination-ready tomorrow:** The model must support removing candidates who don't advance between rounds, with different thresholds per round.
3. **Voting-method flexible:** Later rounds may use ranked-choice voting, pick-one, or other methods instead of approval voting. The model must carry the voting method per round so the UI can adapt.
4. **Auditable:** Every round transition and elimination must be logged in a dedicated audit collection. Endorsements and votes must be traceable to the round they were cast in.
5. **Single source of truth:** `partyConfig.currentRoundId` is the **only** authoritative field for which round is active. All other round state (past, current, future) is derived from this field plus the immutable transition log. No redundant boolean flags.
6. **Transactional and idempotent:** Round transitions must be atomic operations that cannot produce inconsistent state, even if retried or double-triggered.

## Contest Lifecycle

```
Pre-Nomination  →  Round 1  →  Round 2  →  Round 3  →  Town Hall  →  Debate  →  Final Results  →  Post-Election
(applications)     100→20       20→10       10→4        4→2          2→1       (winner)          (archive)
                   approval     approval    approval    ranked       pick-one
                   voting       voting      voting      choice       voting
```

| Round ID              | Label                      | Voting Method   | Candidates In | Advance | Threshold Basis         |
|-----------------------|----------------------------|-----------------|---------------|---------|-------------------------|
| `pre_nomination`      | Pre-Nomination             | none            | open          | all approved | application review   |
| `round_1_endorsement` | First Round: Endorsement   | approval        | ~100          | 20      | endorsement count       |
| `round_2_endorsement` | Second Round: Endorsement  | approval        | 20            | 10      | endorsement count       |
| `round_3_endorsement` | Third Round: Endorsement   | approval        | 10            | 4       | endorsement count       |
| `virtual_town_hall`   | Virtual Town Hall          | ranked_choice   | 4             | 2       | ranked choice tally     |
| `debate`              | Debate                     | pick_one        | 2             | 1       | majority (50%+)         |
| `final_results`       | Final Results              | none            | 1             | —       | —                       |
| `post_election`       | Post-Election              | none            | —             | —       | —                       |

## Current State

**What exists:**
- `ContestStage` type: `'pre_nomination' | 'nomination' | 'voting' | 'post_election'` — only 4 stages, too coarse
- `PartyConfig.contestStage` — single string field, subscribed in real-time via `onSnapshot`
- `PartyConfig.endorsementCutoffs` — array of `{ stage: number, threshold: number, eliminationDate: Timestamp }` — numbered stages, no round IDs
- `applyEndorsementCutoffs()` in `functions/src/admin/partyConfig.ts` — rudimentary elimination: only handles first cutoff on transition to `nomination`
- `manageContestStage()` admin function — updates stage and optionally triggers cutoffs
- `Candidate` type has no `eliminatedAt` or `eliminatedInRound` fields (added dynamically in Cloud Functions but not in the TypeScript type)
- Endorsements have no `roundId` field — all endorsements are undifferentiated
- `calculateRankings` Cloud Function runs hourly but doesn't filter by round
- `updateTrendingScores` runs daily but doesn't account for rounds

**What's missing:**
- Per-round configuration (voting method, thresholds, candidate counts)
- Round-scoped endorsements/votes
- Multi-round elimination logic
- Candidate lifecycle status (active, eliminated, withdrawn, disqualified, winner)
- Voting method support beyond approval voting
- Round transition orchestration with idempotency
- Transition audit log collection
- Tie-handling policy
- Participation window rules
- Contest mode flag (beta vs production)

## Architectural Principles

### Single source of truth for active round

`partyConfig.currentRoundId` is the **only** field that determines the active round. There is no stored `isActive` boolean on round documents. The active round is always derived:

```ts
// Correct: derive active round from currentRoundId
const isActive = (roundId: ContestRoundId) =>
  roundId === partyConfig.currentRoundId;

// Incorrect: do NOT store isActive as a persistent field
// This creates state that can drift from currentRoundId
```

Round completion is determined from the `contestTransitions` audit log, not from a mutable `isComplete` boolean. A round is **historically completed** if a `forward` transition record exists with `fromRoundId === round.id`. However, a completed round may be **administratively reopened** — this is an exceptional action that creates a `reopen` transition record. The prior completion record is not erased; both coexist in the log. To determine the *current* state, always check `partyConfig.currentRoundId` first, then consult the transition log for history.

### Separation of concerns in round data

Round data is conceptually separated into three layers, even though they may coexist in a single Firestore document during Phase 1:

1. **Round definition (static config):** What this round is — `id`, `label`, `shortLabel`, `order`, `votingMethod`, `isEndorsementRound`, `candidatesEntering`, `candidatesAdvancing`. Set during contest initialization, rarely changes.

2. **Round schedule (admin-managed):** When this round runs — `startDate`, `endDate`. Set by admin before contest begins, may be adjusted.

3. **Round execution state (system-managed):** What happened — lives in the `contestTransitions` collection, not on the round document itself. Includes activation timestamp, completion timestamp, tally snapshots, eliminated candidate IDs, tie-break decisions.

This prevents round config documents from becoming half static seed data and half mutable operational record.

## Data Model Changes

### 1\. Extended ContestStage type (`src/types/index.ts`)

```ts
// Replace the current 4-value type:
export type ContestRoundId =
  | 'pre_nomination'
  | 'round_1_endorsement'
  | 'round_2_endorsement'
  | 'round_3_endorsement'
  | 'virtual_town_hall'
  | 'debate'
  | 'final_results'
  | 'post_election';

// DEPRECATED: ContestStage is a backward-compatible alias only. All new code should
// use ContestRoundId directly. Do not reference ContestStage in new logic — it exists
// solely so that existing configStore selectors and partyConfig.contestStage continue
// to compile during migration. It will be removed once all consumers are updated.
export type ContestStage = ContestRoundId;

export type VotingMethod = 'none' | 'approval' | 'ranked_choice' | 'pick_one';

// Contest operating mode
export type ContestMode = 'beta_demo' | 'production';

// Transition types — distinguishes normal progression from exceptional admin actions
export type TransitionType = 'forward' | 'reopen' | 'manual_override';
```

### 2\. ContestRound configuration type (`src/types/index.ts`)

Each round has its own **static** configuration stored in Firestore. This document describes what the round *is*, not what has happened in it.

```ts
export interface ContestRound {
  id: ContestRoundId;
  label: string;                      // Display name (e.g., "First Round: Endorsement")
  shortLabel: string;                 // Short name (e.g., "Round 1")
  order: number;                      // Sort order (0-7)
  votingMethod: VotingMethod;
  isEndorsementRound: boolean;        // True for rounds 1-3
  candidatesEntering: number | null;  // Expected candidates at start (null = open)
  candidatesAdvancing: number | null; // How many advance (null = all)
  startDate: Timestamp | null;        // When this round opens for voting
  endDate: Timestamp | null;          // When this round closes for voting

  // Tie-handling policy for this round
  tieBreakPolicy: TieBreakPolicy;
}

export type TieBreakPolicy =
  | 'advance_all_tied'    // If candidates are tied at the cutoff, all advance (field may temporarily exceed N)
  | 'trending_score'      // Break tie using trendingScore (higher wins)
  | 'admin_decision';     // Flag for manual admin resolution
```

**Note:** No `isActive` or `isComplete` fields. These are derived from `partyConfig.currentRoundId` and the `contestTransitions` log respectively.

### 3\. Updated PartyConfig (`src/types/index.ts`)

```ts
export interface PartyConfig {
  id: string;
  partyName: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string;
  tagline: string;

  // Contest round state — SINGLE SOURCE OF TRUTH
  currentRoundId: ContestRoundId;
  contestStage: ContestStage;         // Backward-compatible alias, always mirrors currentRoundId

  // Contest operating mode
  contestMode: ContestMode;           // 'beta_demo' or 'production'

  // Deprecated — replaced by per-round config in contestRounds collection
  // endorsementCutoffs: EndorsementCutoff[];
}
```

### 4\. Candidate lifecycle status (`src/types/index.ts`)

Rather than a simple `isEliminated` boolean, model the full candidate lifecycle. Candidates can leave the field for reasons other than elimination (withdrawal, disqualification), and the winner needs a terminal state.

```ts
export type CandidateContestStatus =
  | 'active'          // Currently competing
  | 'eliminated'      // Did not advance past a round
  | 'withdrawn'       // Voluntarily left the contest
  | 'disqualified'    // Removed by admin for rules violation
  | 'winner';         // Won the nomination

// Add to Candidate interface:
export interface Candidate {
  // ... existing fields ...
  contestStatus: CandidateContestStatus;  // Default: 'active'
  eliminatedAt?: Timestamp;
  eliminatedInRound?: ContestRoundId;
  eliminationReason?: string;
  // contestStatus is the queryable field; eliminatedAt/InRound provide detail
}
```

Firestore queries filter on `contestStatus`:
```ts
.where('status', '==', 'approved')
.where('contestStatus', '==', 'active')
```

### 5\. Round-scoped endorsements (`src/types/index.ts`)

```ts
export interface Endorsement {
  id: string;
  odid: string;
  candidateId: string;
  roundId: ContestRoundId;    // Which round this endorsement was cast in
  createdAt: Timestamp;
  isActive: boolean;
}
```

Endorsements cast in Round 1 count toward Round 1 thresholds only. When Round 2 opens, users endorse again from the remaining candidates. This prevents endorsement carryover and ensures each round's results reflect that round's voter intent.

**Migration rule:** Existing endorsements without `roundId` are treated as `round_1_endorsement`. After Phase 2 lands, **all new endorsement queries in contest contexts must require a `roundId` filter by design**. Generic "all-time endorsement count" is treated as a separate reporting concept, not the default query.

### 6\. Vote type for non-approval rounds (`src/types/index.ts`)

For ranked-choice and pick-one voting in later rounds. Storage is separate from endorsements, but the service layer should abstract both as "round participation records" (ballots) to enable unified audit queries, fraud review, export, and cross-method analytics.

```ts
export interface Vote {
  id: string;
  odid: string;
  roundId: ContestRoundId;
  votingMethod: VotingMethod;
  // For ranked_choice: ordered array of candidateIds
  // For pick_one: single candidateId
  rankings?: string[];          // Ordered candidate IDs (ranked_choice)
  candidateId?: string;         // Single candidate (pick_one)
  createdAt: Timestamp;
}
```

**Service layer abstraction:** Even though `endorsements` and `votes` are stored separately, service functions should expose a unified interface:

```ts
// Conceptual — actual implementation deferred to Phase 3
interface BallotService {
  castBallot(odid: string, roundId: ContestRoundId, ballot: BallotData): Promise<void>;
  getBallotsByRound(roundId: ContestRoundId): Promise<BallotRecord[]>;
  tallyRound(roundId: ContestRoundId): Promise<TallyResult>;
}
```

This prevents the endorsement/vote split from being hard-coded too deeply into business logic.

## Firestore Collections

### Collection: `contestRounds` (static config)

One document per round, keyed by `ContestRoundId`. Seeded at contest initialization. These documents describe **what each round is**, not what has happened in it.

```
contestRounds/
  pre_nomination          { id, label, order: 0, votingMethod: 'none', tieBreakPolicy: 'advance_all_tied', ... }
  round_1_endorsement     { id, label, order: 1, votingMethod: 'approval', candidatesAdvancing: 20, tieBreakPolicy: 'advance_all_tied', ... }
  round_2_endorsement     { id, label, order: 2, votingMethod: 'approval', candidatesAdvancing: 10, tieBreakPolicy: 'trending_score', ... }
  round_3_endorsement     { id, label, order: 3, votingMethod: 'approval', candidatesAdvancing: 4, tieBreakPolicy: 'trending_score', ... }
  virtual_town_hall       { id, label, order: 4, votingMethod: 'ranked_choice', candidatesAdvancing: 2, tieBreakPolicy: 'admin_decision', ... }
  debate                  { id, label, order: 5, votingMethod: 'pick_one', candidatesAdvancing: 1, tieBreakPolicy: 'admin_decision', ... }
  final_results           { id, label, order: 6, votingMethod: 'none', ... }
  post_election           { id, label, order: 7, votingMethod: 'none', ... }
```

### NEW collection: `contestTransitions` (audit log)

One document per round transition, keyed by `operationId` (the document ID **is** the idempotency key — this is race-proof because `txn.create()` fails if the document already exists). This is the **system of record** for what happened and when. Round completion is determined from this log, not from mutable boolean fields.

```
contestTransitions/
  {operationId}  {                    // Document ID = operationId (idempotency key)
    operationId: string;              // Same as doc ID, for queryability
    transitionType: TransitionType;   // 'forward' | 'reopen' | 'manual_override'
    fromRoundId: ContestRoundId;
    toRoundId: ContestRoundId;
    transitionedAt: Timestamp;
    triggeredBy: 'admin' | 'beta_cron';
    actorId: string | null;           // Admin user ID, or null for cron
    contestMode: ContestMode;         // 'beta_demo' or 'production'

    // Elimination results (null if beta_demo, reopen, or no elimination)
    eliminationApplied: boolean;
    tallySnapshot: Record<string, number> | null;   // candidateId → count at time of transition
    advancedCandidateIds: string[];
    eliminatedCandidateIds: string[];

    // Tie-break info (if applicable)
    tieOccurred: boolean;
    tieBreakMethod: TieBreakPolicy | null;
    tieBreakDetails: string | null;   // Human-readable explanation

    notes: string | null;             // Admin notes / reason for manual transition
  }
```

**`transitionType` semantics:**
- `forward` — Normal progression to the next round in order. The standard case.
- `reopen` — Admin moves `currentRoundId` back to a previously completed round. This is an exceptional action; the round was historically completed but is being administratively reopened. The prior "forward" transition record still exists — reopening does not erase it.
- `manual_override` — Admin jumps to a non-adjacent round (e.g., skipping a round, or any other non-standard transition). Requires explicit `notes` explaining why.

### Updated collection: `endorsements`

Add `roundId` field to every endorsement document. Existing endorsements without `roundId` are treated as `round_1_endorsement` for migration.

### New collection: `votes` (Phase 3)

For ranked-choice and pick-one rounds.

```
votes/
  {voteId}    { odid, roundId, votingMethod, rankings: [...], createdAt }
```

## Tie-Handling Policy

Ties at the advancement cutoff boundary are the most likely source of contested results. The policy must be explicit and logged.

### Rules

1. **What is a tie?** Two or more candidates have the same endorsement count (approval rounds) or the same tally result (other methods) at the Nth position, where N = `candidatesAdvancing`.

2. **Resolution by round type:**

   | Round | Default Policy | Behavior |
   |-------|---------------|----------|
   | Round 1 | `advance_all_tied` | If 3 candidates are tied for 20th place, all 3 advance (22 total instead of 20). The next round absorbs the surplus. |
   | Rounds 2-3 | `trending_score` | Break tie using the candidate's `trendingScore` (7-day weighted metric). Higher score advances. If `trendingScore` is also tied, escalate to `admin_decision`. **Governance note below.** |
   | Town Hall, Debate | `admin_decision` | Admin is notified and must manually resolve the tie. Transition is blocked until resolved. The resolution and reasoning are recorded in the transition log. |

3. **Logging:** Every tie occurrence and its resolution is captured in the `contestTransitions` document: `tieOccurred`, `tieBreakMethod`, `tieBreakDetails`.

4. **No silent drops:** A candidate must never be eliminated due to an ambiguous tie without an explicit, logged resolution.

5. **Governance concern — `trending_score` as official tie-break:** The `trendingScore` metric is influenced by recency, engagement, and profile views — factors not directly tied to round votes. If used as an official tie-break rule, it must be:
   - Documented publicly in contest rules so candidates and voters understand it.
   - Frozen (snapshotted) at the moment of transition, not recalculated after the fact.
   - The snapshot is stored in the `contestTransitions.tallySnapshot` for auditability.

   **Product team decision required:** Is `trendingScore` an officially valid election rule, or just an internal ranking aid? If the product team determines it is not appropriate as an official rule, Rounds 2-3 should fall back to `admin_decision` with explicit written rationale. This decision should be made before the first production round transition.

## Round Participation Windows

### Rules for when votes/endorsements are accepted

1. **Window open:** Endorsements and votes for a round are accepted only while `partyConfig.currentRoundId` matches the round AND the current time is between the round's `startDate` and `endDate` (if set).

2. **Window closed:** Once a round transition occurs (a `contestTransitions` record exists with `fromRoundId` matching), no further endorsements or votes are accepted for that round. Submissions are rejected server-side.

3. **Late submissions:** Hard-blocked. If a user was on the platform but inactive during a round, they cannot submit after the round closes. This is enforced in the Cloud Function that processes endorsements/votes.

4. **Admin override:** An admin can reopen a round by setting `partyConfig.currentRoundId` back to a previous round. This creates a new transition record with a note explaining the reopening. This is an exceptional action and must be logged.

5. **Validity timestamp:** The `createdAt` field on the endorsement/vote document is the timestamp of record. Server-side validation confirms it falls within the round's participation window.

```ts
// Server-side validation in endorsement/vote creation.
// BOTH checks are required — round identity AND time window.
function validateParticipation(
  submittedRoundId: ContestRoundId,
  currentRoundId: ContestRoundId,
  roundConfig: ContestRound,
): void {
  // 1. Round identity check (HARD RULE — always enforced)
  // The submitted roundId must equal partyConfig.currentRoundId at processing time.
  // This prevents stale submissions and cross-round contamination.
  if (submittedRoundId !== currentRoundId) {
    throw new functions.https.HttpsError('failed-precondition',
      `Submissions are only accepted for the current round (${currentRoundId}). ` +
      `Received: ${submittedRoundId}.`);
  }

  // 2. Time window check (enforced when dates are set)
  const now = admin.firestore.Timestamp.now();
  if (roundConfig.startDate && now < roundConfig.startDate) {
    throw new functions.https.HttpsError('failed-precondition', 'This round has not opened yet.');
  }
  if (roundConfig.endDate && now > roundConfig.endDate) {
    throw new functions.https.HttpsError('failed-precondition', 'This round has closed for voting.');
  }
}
```

**Hard rule:** Every endorsement and vote submission must pass `validateParticipation()` server-side. Validating only time windows without checking `roundId === currentRoundId` is **not sufficient** — it would allow submissions to a round that has dates in the future but is not the active round.

## ConfigStore Changes (`src/stores/configStore.ts`)

### Add round-aware selectors and state

```ts
interface ConfigState {
  partyConfig: PartyConfig | null;
  contestRounds: ContestRound[];      // All round configs (static)
  currentRound: ContestRound | null;  // Derived from currentRoundId + contestRounds
  issues: Issue[];
  isLoading: boolean;
  error: string | null;

  initialize: () => () => void;
  fetchConfig: () => Promise<void>;
  fetchIssues: () => Promise<void>;
  fetchContestRounds: () => Promise<void>;
  setError: (error: string | null) => void;
}
```

### New selectors

```ts
// Current round's voting method
export const selectVotingMethod = (state: ConfigState): VotingMethod =>
  state.currentRound?.votingMethod || 'none';

// Whether endorsements/votes are currently accepted.
// Reflects the full participation-window rules, not just voting method.
//
// CLIENT TIME CAVEAT: This selector uses the client's local clock (new Date()).
// If the user's clock is wrong, the UI may show "can vote" when the server will
// reject, or hide voting when it's actually open. This is an accepted trade-off
// for client-side selectors — the server is the authoritative enforcer via
// validateParticipation(). If UX confusion becomes an issue, consider syncing
// an approximate server time offset on app init.
export const selectCanVote = (state: ConfigState): boolean => {
  const round = state.currentRound;
  if (!round) return false;
  if (round.votingMethod === 'none') return false;

  const now = new Date();
  if (round.startDate && now < round.startDate.toDate()) return false;
  if (round.endDate && now > round.endDate.toDate()) return false;

  return true;
};

// Whether this is an endorsement round (rounds 1-3)
export const selectIsEndorsementRound = (state: ConfigState): boolean =>
  state.currentRound?.isEndorsementRound || false;

// Current round's label for display
export const selectCurrentRoundLabel = (state: ConfigState): string =>
  state.currentRound?.label || 'Pre-Nomination';

// All rounds in order (for About the Contest timeline)
export const selectContestTimeline = (state: ConfigState): ContestRound[] =>
  [...state.contestRounds].sort((a, b) => a.order - b.order);

// Derive round status from currentRoundId (no stored booleans)
export const selectRoundStatus = (roundId: ContestRoundId) =>
  (state: ConfigState): 'past' | 'current' | 'future' => {
    const currentRound = state.contestRounds.find(
      r => r.id === state.partyConfig?.currentRoundId
    );
    const targetRound = state.contestRounds.find(r => r.id === roundId);
    if (!currentRound || !targetRound) return 'future';
    if (targetRound.order < currentRound.order) return 'past';
    if (targetRound.order === currentRound.order) return 'current';
    return 'future';
  };

// Contest mode
export const selectContestMode = (state: ConfigState): ContestMode =>
  state.partyConfig?.contestMode || 'beta_demo';
```

**Derivation note:** `selectRoundStatus` compares `order` values to determine past/current/future, using only `currentRoundId` as input. No `isActive` or `isComplete` booleans are read from round documents. If a round is reopened (admin sets `currentRoundId` back to a previously completed round), `selectRoundStatus` will correctly show it as `'current'` and later rounds as `'future'` — because it derives entirely from `currentRoundId`, not from transition history.

## Cloud Functions

### Round transition functions (`functions/src/admin/transitionRound.ts`)

Two separate Cloud Functions handle the two fundamentally different operations:

1. **`transitionForward`** — Normal forward progression with elimination. The standard case.
2. **`transitionToRound`** — Admin moves to any round (reopen or skip). No elimination. Exceptional.

Both are **transactional** and **idempotent** (operationId is the doc ID; `txn.create()` fails on duplicates). Clients should treat `already_processed` as a success-equivalent outcome, not an error — it means the operation was safely replayed.

#### Forward transition (standard)

```ts
export const transitionForward = functions.https.onCall(async (data, context) => {
  const operationId = data.operationId || uuidv4();
  if (!context.auth?.token.admin) throw new HttpsError('permission-denied', '...');

  return db.runTransaction(async (txn) => {
    // Idempotency: operationId IS the document ID (race-proof)
    const transitionRef = db.collection('contestTransitions').doc(operationId);
    const existing = await txn.get(transitionRef);
    if (existing.exists) {
      return { status: 'already_processed', transitionId: operationId };
    }

    // Read current state
    const configRef = db.doc('config/partyConfig');
    const configSnap = await txn.get(configRef);
    const currentRoundId = configSnap.data()?.currentRoundId;

    // REQUIRED guard: caller MUST confirm which round they expect to be transitioning from.
    // This is the primary defense against double-forward races (two admins or retries with
    // different operationIds reading the same currentRoundId before either writes).
    // If currentRoundId has already moved, the second caller's expectedFromRound won't match.
    if (!data.expectedFromRound) {
      throw new HttpsError('invalid-argument', 'expectedFromRound is required.');
    }
    if (data.expectedFromRound !== currentRoundId) {
      throw new HttpsError('failed-precondition',
        `Expected to transition from ${data.expectedFromRound} but current is ${currentRoundId}`);
    }

    // Resolve next round
    const roundsSnap = await txn.get(db.collection('contestRounds').orderBy('order'));
    const rounds = roundsSnap.docs.map(d => d.data() as ContestRound);
    const currentIndex = rounds.findIndex(r => r.id === currentRoundId);
    const nextRound = rounds[currentIndex + 1];
    if (!nextRound) throw new HttpsError('failed-precondition', 'No next round.');

    const contestMode = configSnap.data()?.contestMode || 'production';

    // Elimination (skip in beta_demo)
    let advancedIds: string[] = [];
    let eliminatedIds: string[] = [];
    let tallySnapshot: Record<string, number> | null = null;
    let tieOccurred = false;
    let tieBreakDetails: string | null = null;

    if (contestMode === 'production' && rounds[currentIndex].candidatesAdvancing) {
      const result = await performElimination(txn, rounds[currentIndex], currentRoundId!);
      advancedIds = result.advancedIds;
      eliminatedIds = result.eliminatedIds;
      tallySnapshot = result.tallySnapshot;
      tieOccurred = result.tieOccurred;
      tieBreakDetails = result.tieBreakDetails;
    }

    // Update partyConfig (single source of truth)
    txn.update(configRef, {
      currentRoundId: nextRound.id,
      contestStage: nextRound.id,
    });

    // Write audit record
    txn.create(transitionRef, {
      operationId,
      transitionType: 'forward',
      fromRoundId: currentRoundId,
      toRoundId: nextRound.id,
      transitionedAt: FieldValue.serverTimestamp(),
      triggeredBy: data.triggeredBy || 'admin',
      actorId: context.auth?.uid || null,
      contestMode,
      eliminationApplied: eliminatedIds.length > 0,
      tallySnapshot,
      advancedCandidateIds: advancedIds,
      eliminatedCandidateIds: eliminatedIds,
      tieOccurred,
      tieBreakMethod: tieOccurred ? rounds[currentIndex].tieBreakPolicy : null,
      tieBreakDetails,
      notes: data.notes || null,
    });

    // Note: FieldValue.serverTimestamp() is not resolved in the return payload.
    return { status: 'success', transitionId: operationId, toRound: nextRound.id };
  });
});
```

#### Admin transition to any round (reopen / manual override)

```ts
export const transitionToRound = functions.https.onCall(async (data, context) => {
  const operationId = data.operationId || uuidv4();
  if (!context.auth?.token.admin) throw new HttpsError('permission-denied', '...');

  // targetRoundId is required — the admin explicitly names the destination
  const targetRoundId: ContestRoundId = data.targetRoundId;
  if (!targetRoundId) throw new HttpsError('invalid-argument', 'targetRoundId is required.');

  // notes are required for non-forward transitions
  if (!data.notes) throw new HttpsError('invalid-argument', 'Admin notes are required for reopen/override.');

  return db.runTransaction(async (txn) => {
    const transitionRef = db.collection('contestTransitions').doc(operationId);
    const existing = await txn.get(transitionRef);
    if (existing.exists) {
      return { status: 'already_processed', transitionId: operationId };
    }

    const configRef = db.doc('config/partyConfig');
    const configSnap = await txn.get(configRef);
    const currentRoundId = configSnap.data()?.currentRoundId;
    const contestMode = configSnap.data()?.contestMode || 'production';

    // Validate target round exists
    const targetRoundSnap = await txn.get(db.doc(`contestRounds/${targetRoundId}`));
    if (!targetRoundSnap.exists) throw new HttpsError('not-found', `Round ${targetRoundId} not found.`);

    // Determine transition type
    const targetOrder = targetRoundSnap.data()?.order;
    const currentRoundSnap = await txn.get(db.doc(`contestRounds/${currentRoundId}`));
    const currentOrder = currentRoundSnap.data()?.order;
    const transitionType: TransitionType =
      targetOrder < currentOrder ? 'reopen' : 'manual_override';

    // No elimination on reopen/override — this is an admin correction, not a contest progression
    txn.update(configRef, {
      currentRoundId: targetRoundId,
      contestStage: targetRoundId,
    });

    txn.create(transitionRef, {
      operationId,
      transitionType,
      fromRoundId: currentRoundId,
      toRoundId: targetRoundId,
      transitionedAt: FieldValue.serverTimestamp(),
      triggeredBy: 'admin',
      actorId: context.auth?.uid || null,
      contestMode,
      eliminationApplied: false,
      tallySnapshot: null,
      advancedCandidateIds: [],
      eliminatedCandidateIds: [],
      tieOccurred: false,
      tieBreakMethod: null,
      tieBreakDetails: null,
      notes: data.notes,
    });

    return { status: 'success', transitionId: operationId, toRound: targetRoundId };
  });
});
```

### Elimination logic (per voting method)

```ts
async function performElimination(
  txn: Transaction,
  roundConfig: ContestRound,
  roundId: ContestRoundId,
): Promise<EliminationResult> {
  const N = roundConfig.candidatesAdvancing!;

  // 1. Get active candidates
  const candidatesSnap = await txn.get(
    db.collection('candidates')
      .where('status', '==', 'approved')
      .where('contestStatus', '==', 'active')
  );

  // 2. Tally per voting method
  //
  // ⚠️ RAW READS ARE FOR INITIAL ROLLOUT ONLY.
  // Production-scale deployments MUST use precomputed tally documents
  // (e.g., a roundTally/{roundId} doc maintained by an aggregation Cloud Function).
  // Raw endorsement/vote reads inside a transaction will hit Firestore transaction
  // read limits and become slow/expensive once endorsements exceed ~5-10k per round.
  // The existing calculateRankings hourly function should be extended to produce
  // per-round tally snapshots that feed this step.
  // This is not optional at scale — plan the migration to precomputed tallies
  // before the first production contest with significant user volume.
  let tally: Map<string, number>;

  switch (roundConfig.votingMethod) {
    case 'approval':
      // Count endorsements per candidate for THIS round only
      const endorsementsSnap = await txn.get(
        db.collection('endorsements')
          .where('roundId', '==', roundId)
          .where('isActive', '==', true)
      );
      tally = countEndorsementsPerCandidate(endorsementsSnap);
      break;

    case 'ranked_choice':
      // Implement instant-runoff tallying
      // Eliminate lowest-ranked candidate iteratively until N remain
      tally = tallyRankedChoice(/* votes */);
      break;

    case 'pick_one':
      // Count votes per candidate; winner needs 50%+
      tally = countPickOneVotes(/* votes */);
      break;

    default:
      return { advancedIds: [], eliminatedIds: [], tallySnapshot: null, tieOccurred: false, tieBreakDetails: null };
  }

  // 3. Sort by tally descending
  const sorted = [...tally.entries()].sort((a, b) => b[1] - a[1]);

  // 4. Determine cutoff with tie handling
  const { advancedIds, eliminatedIds, tieOccurred, tieBreakDetails } =
    applyCutoffWithTieBreak(sorted, N, roundConfig.tieBreakPolicy, candidatesSnap);

  // 5. Mark eliminated candidates
  //
  // WRITE LIMIT GUARD: Firestore transactions have a 500-write limit. With elimination
  // updates + the transition audit record + partyConfig update, assert that the candidate
  // count stays safely within bounds. For the current contest sizes (≤100 candidates),
  // this is well within limits. If scaling beyond ~400 candidates, switch to chunked
  // batch updates outside the transaction (after the transition record is written).
  if (eliminatedIds.length > 400) {
    throw new Error(`Elimination set too large for single transaction (${eliminatedIds.length}). Use chunked updates.`);
  }

  for (const candidateId of eliminatedIds) {
    txn.update(db.doc(`candidates/${candidateId}`), {
      contestStatus: 'eliminated',
      eliminatedAt: FieldValue.serverTimestamp(),
      eliminatedInRound: roundId,
      eliminationReason: `Did not advance past ${roundConfig.label}`,
    });
  }

  // 6. Return results
  const tallySnapshot = Object.fromEntries(tally);
  return { advancedIds, eliminatedIds, tallySnapshot, tieOccurred, tieBreakDetails };
}
```

### Tie-break implementation

```ts
function applyCutoffWithTieBreak(
  sorted: [string, number][],
  N: number,
  policy: TieBreakPolicy,
  candidatesSnap: QuerySnapshot,
): { advancedIds: string[], eliminatedIds: string[], tieOccurred: boolean, tieBreakDetails: string | null } {

  if (sorted.length <= N) {
    return { advancedIds: sorted.map(s => s[0]), eliminatedIds: [], tieOccurred: false, tieBreakDetails: null };
  }

  const cutoffScore = sorted[N - 1][1]; // Score at the Nth position

  // Identify the three groups by position:
  const aboveCutoff = sorted.filter(s => s[1] > cutoffScore);    // Safely above — always advance
  const atCutoff = sorted.filter(s => s[1] === cutoffScore);      // Tied group at the boundary
  const belowCutoff = sorted.filter(s => s[1] < cutoffScore);     // Safely below — always eliminated

  // A tie is meaningful only if the tied group straddles the cutoff boundary:
  // some tied candidates would be inside top N, others outside.
  // This happens when the above-cutoff group doesn't fill all N spots,
  // but the tied group is larger than the remaining spots.
  const spotsRemaining = N - aboveCutoff.length;
  const tieOccurred = atCutoff.length > spotsRemaining && spotsRemaining > 0;
  // (Note: the sample code below is illustrative — engineering should write production
  // tie logic with thorough unit tests covering edge cases.)

  if (!tieOccurred) {
    // Clean cut — no ties at boundary
    const advancedIds = sorted.slice(0, N).map(s => s[0]);
    const eliminatedIds = sorted.slice(N).map(s => s[0]);
    return { advancedIds, eliminatedIds, tieOccurred: false, tieBreakDetails: null };
  }

  // Tie at the cutoff boundary
  switch (policy) {
    case 'advance_all_tied':
      // Everyone in the tied group advances alongside those safely above
      const advanceAll = [...aboveCutoff, ...atCutoff].map(s => s[0]);
      return {
        advancedIds: advanceAll,
        eliminatedIds: belowCutoff.map(s => s[0]),
        tieOccurred: true,
        tieBreakDetails: `${atCutoff.length} candidates tied at ${cutoffScore}; all advanced (${advanceAll.length} total vs target ${N})`,
      };

    case 'trending_score':
      // Break tie using trendingScore from candidate documents.
      // IMPORTANT: Snapshot the trendingScore values at this moment and store them
      // in tieBreakDetails so the tie-break can be reproduced/audited later.
      // The live trendingScore may change after transition (daily recalculation).
      const tiedWithScores = atCutoff.map(([id, count]) => {
        const doc = candidatesSnap.docs.find(d => d.id === id);
        return { id, count, trendingScore: doc?.data().trendingScore || 0 };
      }).sort((a, b) => b.trendingScore - a.trendingScore);

      // Fill the remaining spots from the tied group
      const tieWinners = tiedWithScores.slice(0, spotsRemaining).map(t => t.id);
      const tieLosers = tiedWithScores.slice(spotsRemaining).map(t => t.id);

      // Build auditable snapshot of the tie-break inputs
      const trendingSnapshot = tiedWithScores.map(t =>
        `${t.id}: endorsements=${t.count}, trendingScore=${t.trendingScore}`
      ).join('; ');

      return {
        advancedIds: [...aboveCutoff.map(s => s[0]), ...tieWinners],
        eliminatedIds: [...tieLosers, ...belowCutoff.map(s => s[0])],
        tieOccurred: true,
        tieBreakDetails: `${atCutoff.length} candidates tied at ${cutoffScore}; broken by trendingScore. Snapshot: ${trendingSnapshot}`,
      };

    case 'admin_decision':
      // Block transition — admin must resolve manually
      throw new functions.https.HttpsError(
        'failed-precondition',
        `Tie at cutoff: ${atCutoff.length} candidates have ${cutoffScore} votes. Admin must resolve manually via the tieResolution parameter.`
      );
  }
}
```

### Beta cron function (`functions/src/cron/advanceContestRound.ts`)

During the beta, advances the round daily on a schedule. Uses `contestMode: 'beta_demo'` to skip elimination. Every advancement is still logged to `contestTransitions` with `triggeredBy: 'beta_cron'` for auditability.

```ts
export const advanceContestRoundDaily = functions.pubsub
  .schedule('0 0 * * *')
  .timeZone('America/New_York')
  .onRun(async () => {
    const db = admin.firestore();
    const configRef = db.doc('config/partyConfig');
    const configSnap = await configRef.get();
    const currentRoundId = configSnap.data()?.currentRoundId || 'pre_nomination';
    const contestMode = configSnap.data()?.contestMode || 'beta_demo';

    // Only run in beta_demo mode
    if (contestMode !== 'beta_demo') {
      console.log('Not in beta_demo mode, skipping automatic advancement.');
      return;
    }

    // Get ordered rounds
    const roundsSnap = await db.collection('contestRounds').orderBy('order').get();
    const rounds = roundsSnap.docs.map(d => d.data());
    const currentIndex = rounds.findIndex(r => r.id === currentRoundId);

    if (currentIndex < 0 || currentIndex >= rounds.length - 1) {
      console.log('Contest complete or round not found.');
      return;
    }

    const nextRound = rounds[currentIndex + 1];
    const operationId = `beta_cron_${currentRoundId}_to_${nextRound.id}`;

    // Use a transaction (not batch) for atomicity parity with the admin flow.
    // A batch is not fully atomic in the same way — if it fails mid-flight,
    // config could update without the transition record being written.
    await db.runTransaction(async (txn) => {
      const transitionRef = db.collection('contestTransitions').doc(operationId);
      const existing = await txn.get(transitionRef);
      if (existing.exists) {
        console.log('Transition already processed.');
        return;
      }

      txn.update(configRef, {
        currentRoundId: nextRound.id,
        contestStage: nextRound.id,
      });
      txn.create(transitionRef, {
        operationId,
        transitionType: 'forward',
        fromRoundId: currentRoundId,
        toRoundId: nextRound.id,
        transitionedAt: admin.firestore.FieldValue.serverTimestamp(),
        triggeredBy: 'beta_cron',
        actorId: null,
        contestMode: 'beta_demo',
        eliminationApplied: false,
        tallySnapshot: null,
        advancedCandidateIds: [],
        eliminatedCandidateIds: [],
        tieOccurred: false,
        tieBreakMethod: null,
        tieBreakDetails: null,
        notes: 'Automatic daily advancement for beta demo',
      });
    });

    console.log(`[beta_demo] Advanced from ${currentRoundId} to ${nextRound.id}`);
  });
```

## Client-Side Round-Aware Behavior

### Query filtering by round

Candidate queries must filter on `contestStatus`:

```ts
// Updated: only show active candidates
.where('status', '==', 'approved')
.where('contestStatus', '==', 'active')
```

### Endorsement/vote submission

The UI must pass the current `roundId` when creating endorsements or votes, and the server must validate the participation window:

```ts
// In userStore or service layer:
const endorseCandidate = async (odid: string, candidateId: string) => {
  const currentRoundId = useConfigStore.getState().partyConfig?.currentRoundId;
  await createEndorsement(odid, candidateId, currentRoundId);
  // Server-side: validates roundId matches currentRoundId, checks participation window
};
```

### Voting method UI adaptation

Components that show endorse/vote buttons must check the current voting method:

```ts
const votingMethod = useConfigStore(selectVotingMethod);
const canVote = useConfigStore(selectCanVote);

switch (votingMethod) {
  case 'approval':
    // Show endorse/un-endorse toggle (current behavior)
    break;
  case 'ranked_choice':
    // Show drag-to-rank interface
    break;
  case 'pick_one':
    // Show radio-button style single selection
    break;
  case 'none':
    // Show results only, no voting buttons
    break;
}
```

## Seed Data

### Contest rounds seed (`functions/src/admin/seedContestRounds.ts`)

```ts
const CONTEST_ROUNDS: ContestRound[] = [
  {
    id: 'pre_nomination',
    label: 'Pre-Nomination',
    shortLabel: 'Pre-Nom',
    order: 0,
    votingMethod: 'none',
    isEndorsementRound: false,
    candidatesEntering: null,
    candidatesAdvancing: null,
    startDate: null,
    endDate: null,
    tieBreakPolicy: 'advance_all_tied',
  },
  {
    id: 'round_1_endorsement',
    label: 'First Round: Endorsement',
    shortLabel: 'Round 1',
    order: 1,
    votingMethod: 'approval',
    isEndorsementRound: true,
    candidatesEntering: 100,
    candidatesAdvancing: 20,
    startDate: null,
    endDate: null,
    tieBreakPolicy: 'advance_all_tied',
  },
  {
    id: 'round_2_endorsement',
    label: 'Second Round: Endorsement',
    shortLabel: 'Round 2',
    order: 2,
    votingMethod: 'approval',
    isEndorsementRound: true,
    candidatesEntering: 20,
    candidatesAdvancing: 10,
    startDate: null,
    endDate: null,
    tieBreakPolicy: 'trending_score',
  },
  {
    id: 'round_3_endorsement',
    label: 'Third Round: Endorsement',
    shortLabel: 'Round 3',
    order: 3,
    votingMethod: 'approval',
    isEndorsementRound: true,
    candidatesEntering: 10,
    candidatesAdvancing: 4,
    startDate: null,
    endDate: null,
    tieBreakPolicy: 'trending_score',
  },
  {
    id: 'virtual_town_hall',
    label: 'Virtual Town Hall',
    shortLabel: 'Town Hall',
    order: 4,
    votingMethod: 'ranked_choice',
    isEndorsementRound: false,
    candidatesEntering: 4,
    candidatesAdvancing: 2,
    startDate: null,
    endDate: null,
    tieBreakPolicy: 'admin_decision',
  },
  {
    id: 'debate',
    label: 'Debate',
    shortLabel: 'Debate',
    order: 5,
    votingMethod: 'pick_one',
    isEndorsementRound: false,
    candidatesEntering: 2,
    candidatesAdvancing: 1,
    startDate: null,
    endDate: null,
    tieBreakPolicy: 'admin_decision',
  },
  {
    id: 'final_results',
    label: 'Final Results',
    shortLabel: 'Results',
    order: 6,
    votingMethod: 'none',
    isEndorsementRound: false,
    candidatesEntering: 1,
    candidatesAdvancing: null,
    startDate: null,
    endDate: null,
    tieBreakPolicy: 'advance_all_tied',
  },
  {
    id: 'post_election',
    label: 'Post-Election',
    shortLabel: 'Archive',
    order: 7,
    votingMethod: 'none',
    isEndorsementRound: false,
    candidatesEntering: null,
    candidatesAdvancing: null,
    startDate: null,
    endDate: null,
    tieBreakPolicy: 'advance_all_tied',
  },
];
```

## Migration Path

### Phase 1 (Content only) ✅ RE-IMPLEMENTED 2026-03-25

Re-implemented after branch reset (original implementation was on abandoned branch). All Phase 1 items are complete. Files implemented:

**Types:** `src/types/index.ts`, `src/types/index.web.ts`
- Added `ContestRoundId`, `ContestRound`, `VotingMethod`, `ContestMode`, `TransitionType`, `TieBreakPolicy`, `ContestTransition` types
- Updated `PartyConfig` with `currentRoundId` and `contestMode`
- Marked `ContestStage` as `@deprecated` alias for `ContestRoundId`

**Data layer:** `src/services/firebase/config.ts`, `config.web.ts`, `firestore.ts`
- Added `CONTEST_ROUNDS` and `CONTEST_TRANSITIONS` collection constants
- Added `getContestRounds()` and `seedContestRounds()` Firestore functions

**State management:** `src/stores/configStore.ts`, `src/stores/index.ts`
- Added `contestRounds`, `currentRound` state with `fetchContestRounds()` method
- Added selectors: `selectCurrentRoundId`, `selectVotingMethod`, `selectCanVote`, `selectIsEndorsementRound`, `selectCurrentRoundLabel`, `selectContestTimeline`, `selectRoundStatus`, `selectContestMode`
- `initialize()` fetches rounds and derives `currentRound` on config changes

**UI:** `src/constants/faqs.ts` (new), `src/components/home/VoterHome.tsx`
- Dynamic FAQs keyed by `ContestRoundId` via `getFaqsForRound()` — replaces hardcoded FAQs

**Cloud Functions:** `functions/src/admin/seedContestRounds.ts` (new), `functions/src/cron/advanceContestRound.ts` (new), `functions/src/admin/partyConfig.ts`, `functions/src/index.ts`
- Admin callable to seed 8 contest round documents
- Daily beta cron with transactional advancement and audit records
- Notification messages expanded for all 8 round IDs

**No elimination, no voting method changes, no round-scoped endorsements yet.**

### Phase 2 (Next sprint — elimination)
- **Candidate backfill (MUST happen before query changes):** Run a one-time migration to set `contestStatus: 'active'` on all existing approved candidate documents. Without this, switching queries to `.where('contestStatus', '==', 'active')` will silently hide candidates that lack the field. This backfill is a prerequisite for all other Phase 2 work.
- Add `roundId` to Endorsement type and creation logic
- Add `contestStatus: CandidateContestStatus` to Candidate type (replacing ad-hoc `eliminatedAt` checks)
- Update all candidate queries to filter `contestStatus === 'active'`
- Implement `transitionForward` and `transitionToRound` Cloud Functions with elimination, tie handling, and idempotency
- Add server-side participation window validation
- Update leaderboard to show round-specific endorsement counts
- Update For You feed to hide eliminated candidates
- Enforce that all new endorsement queries in contest contexts require a `roundId` filter

**Endorsement migration and user-facing history:**
When `roundId` is added to endorsements, existing endorsements without `roundId` are treated as `round_1_endorsement`. This affects user-facing display:
- "Your Endorsements" screen should show migrated endorsements under "Round 1" labeling
- Candidate endorsement stats should distinguish round-specific counts from all-time totals
- All-time totals are a **separate reporting concept**, not the default. The default view in contest contexts is always round-specific.

### Phase 3 (Future — voting methods)
- Add `Vote` type and `votes` collection
- Implement ranked-choice voting UI and tallying (instant-runoff)
- Implement pick-one voting UI
- Build unified `BallotService` abstraction over endorsements and votes
- Add `selectVotingMethod` selector to drive UI changes
- Build round-specific voting components

**Ranked-choice is not yet fully specified.** The `Vote` type and storage are defined, but ranked-choice introduces policy questions beyond tallying: exhausted ballots, duplicate/skipped rankings, partial ballots, tie-breaking during IRV elimination rounds, and whether advancing top-2-from-4 via IRV is the intended rule. These rules need explicit product decisions before Phase 3 implementation. The current plan provides the storage and transition foundation; the voting rules themselves are deferred.

## Cross-References

This plan is referenced by:
- **PLAN-11** (Dynamic FAQs) — uses `currentRoundId` to select FAQ content
- **PLAN-13** (Leaderboard) — will need round-scoped endorsement counts in Phase 2
- **PLAN-16** (About the Contest) — uses `contestRounds` for timeline rendering and round highlighting
- **PLAN-12** (For You) — will need to hide eliminated candidates in Phase 2
- **PLAN-09** (Homepage) — round label displayed in sections

## Testing

### Phase 1
- Changing `currentRoundId` in Firestore updates all round-dependent content in real-time
- Beta cron advances rounds daily and writes `contestTransitions` records
- `selectRoundStatus` correctly derives past/current/future from `currentRoundId` and `order` (no boolean fields)
- About the Contest timeline highlights the correct round
- FAQs change per round
- `selectVotingMethod`, `selectCanVote`, `selectIsEndorsementRound` return correct values for each round
- `contestMode` is readable and drives cron behavior

### Phase 2
- Round transition eliminates the non-advancing candidates according to tally and tie policy
- Ties at cutoff are handled per `tieBreakPolicy` and logged
- `admin_decision` tie-break blocks transition until resolved
- Transition is idempotent: retrying with same `operationId` returns `already_processed`
- Eliminated candidates have `contestStatus: 'eliminated'` and no longer appear in feed, leaderboard, or search
- Endorsements are tagged with `roundId`; queries without `roundId` filter are flagged in code review
- Round-specific endorsement counts are accurate
- Participation window validation rejects late submissions
- `contestTransitions` collection has a complete record of every round change with tally snapshots
- Withdrawn and disqualified candidates have appropriate `contestStatus` values

### Phase 3
- Ranked-choice UI renders with draggable candidate ordering
- Pick-one UI renders with radio selection
- Vote tallying produces correct results per method
- Round transition uses correct tallying method
- `BallotService` can query endorsements and votes uniformly for audit/export
