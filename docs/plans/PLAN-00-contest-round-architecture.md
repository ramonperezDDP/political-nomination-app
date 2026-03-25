# PLAN-00: Contest Round Architecture (Foundation)

## Summary

This is the foundational plan that defines the **contest round** state model. Every other plan that references contest rounds, FAQs, candidate elimination, voting methods, or round-specific UI behavior depends on this architecture.

The contest round is a **global, shared state** — all users see the same round at the same time, regardless of when they signed up. A user who joins on day 5 enters whatever round is active on that day.

## Design Goals

1. **Content-driven today:** Initially, the round state drives text content (FAQs, explainers, About the Contest timeline, section labels).
2. **Elimination-ready tomorrow:** The model must support removing candidates who don't advance between rounds, with different thresholds per round.
3. **Voting-method flexible:** Later rounds may use ranked-choice voting, pick-one, or other methods instead of approval voting. The model must carry the voting method per round so the UI can adapt.
4. **Auditable:** Every round transition and elimination must be logged. Endorsements and votes must be traceable to the round they were cast in.

## Contest Lifecycle

```
Pre-Nomination  →  Round 1  →  Round 2  →  Round 3  →  Town Hall  →  Debate  →  Results  →  Post-Election
(applications)     100→20       20→10       10→4        4→2          2→1       (winner)     (archive)
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
- Candidate status per round (active, eliminated, advanced)
- Voting method support beyond approval voting
- Round transition orchestration

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

// Keep ContestStage as an alias for backward compatibility in configStore selectors
export type ContestStage = ContestRoundId;

export type VotingMethod = 'none' | 'approval' | 'ranked_choice' | 'pick_one';
```

### 2\. ContestRound configuration type (`src/types/index.ts`)

Each round has its own configuration stored in Firestore. This allows the admin (or the beta cron) to define thresholds, dates, and voting methods per round.

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
  eliminationThreshold: number | null;// Min endorsements/votes to advance (null = no threshold)
  startDate: Timestamp | null;        // When this round begins
  endDate: Timestamp | null;          // When this round closes for voting
  isActive: boolean;                  // True if this is the current round
  isComplete: boolean;                // True if round has concluded
}
```

### 3\. Updated PartyConfig (`src/types/index.ts`)

```ts
export interface PartyConfig {
  id: string;
  partyName: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string;
  tagline: string;

  // Contest round state
  currentRoundId: ContestRoundId;         // The active round (replaces contestStage)
  contestStage: ContestStage;             // Kept for backward compatibility, mirrors currentRoundId

  // Deprecated — replaced by per-round config
  // endorsementCutoffs: EndorsementCutoff[];
}
```

### 4\. Round-scoped endorsements (`src/types/index.ts`)

```ts
export interface Endorsement {
  id: string;
  odid: string;
  candidateId: string;
  roundId: ContestRoundId;    // NEW: which round this endorsement was cast in
  createdAt: Timestamp;
  isActive: boolean;
}
```

Endorsements cast in Round 1 count toward Round 1 thresholds only. When Round 2 opens, users endorse again from the remaining candidates. This prevents endorsement carryover and ensures each round's results reflect that round's voter intent.

### 5\. Candidate round status (`src/types/index.ts`)

```ts
// Add to Candidate interface:
export interface Candidate {
  // ... existing fields ...
  eliminatedAt?: Timestamp;
  eliminatedInRound?: ContestRoundId;
  eliminationReason?: string;
  // Active candidates: eliminatedAt is undefined
  // Eliminated candidates: eliminatedAt is set, eliminatedInRound identifies when
}
```

### 6\. Vote type for non-approval rounds (`src/types/index.ts`)

For ranked-choice and pick-one voting in later rounds:

```ts
export interface Vote {
  id: string;
  odid: string;
  roundId: ContestRoundId;
  votingMethod: VotingMethod;
  // For approval voting: single candidateId (same as Endorsement)
  // For ranked_choice: ordered array of candidateIds
  // For pick_one: single candidateId
  rankings?: string[];          // Ordered candidate IDs (ranked_choice)
  candidateId?: string;         // Single candidate (pick_one)
  createdAt: Timestamp;
}
```

## Firestore Collections

### New collection: `contestRounds`

One document per round, keyed by `ContestRoundId`. Seeded at contest initialization.

```
contestRounds/
  pre_nomination          { id, label, order: 0, votingMethod: 'none', ... }
  round_1_endorsement     { id, label, order: 1, votingMethod: 'approval', eliminationThreshold: 50, ... }
  round_2_endorsement     { id, label, order: 2, votingMethod: 'approval', eliminationThreshold: 100, ... }
  round_3_endorsement     { id, label, order: 3, votingMethod: 'approval', eliminationThreshold: 200, ... }
  virtual_town_hall       { id, label, order: 4, votingMethod: 'ranked_choice', ... }
  debate                  { id, label, order: 5, votingMethod: 'pick_one', ... }
  final_results           { id, label, order: 6, votingMethod: 'none', ... }
  post_election           { id, label, order: 7, votingMethod: 'none', ... }
```

### Updated collection: `endorsements`

Add `roundId` field to every endorsement document. Existing endorsements without `roundId` are treated as `round_1_endorsement` for migration.

### New collection: `votes`

For ranked-choice and pick-one rounds. Separate from endorsements to keep data models clean.

```
votes/
  {voteId}    { odid, roundId, votingMethod, rankings: [...], createdAt }
```

## ConfigStore Changes (`src/stores/configStore.ts`)

### Add round-aware selectors and state

```ts
interface ConfigState {
  partyConfig: PartyConfig | null;
  contestRounds: ContestRound[];      // NEW: all round configs
  currentRound: ContestRound | null;  // NEW: derived from currentRoundId
  issues: Issue[];
  isLoading: boolean;
  error: string | null;

  initialize: () => () => void;
  fetchConfig: () => Promise<void>;
  fetchIssues: () => Promise<void>;
  fetchContestRounds: () => Promise<void>;  // NEW
  setError: (error: string | null) => void;
}
```

### New selectors

```ts
// Current round's voting method
export const selectVotingMethod = (state: ConfigState): VotingMethod =>
  state.currentRound?.votingMethod || 'none';

// Whether endorsements/votes are currently accepted
export const selectCanVote = (state: ConfigState): boolean => {
  const method = state.currentRound?.votingMethod;
  return method !== 'none' && method !== undefined;
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

// Past, current, future round classification (for timeline highlighting)
export const selectRoundStatus = (state: ConfigState, roundId: ContestRoundId):
  'past' | 'current' | 'future' => {
  const round = state.contestRounds.find(r => r.id === roundId);
  if (!round) return 'future';
  if (round.isComplete) return 'past';
  if (round.isActive) return 'current';
  return 'future';
};
```

## Cloud Functions

### Round transition function (`functions/src/admin/transitionRound.ts`)

Orchestrates moving from one round to the next. This is the most critical function in the contest — it eliminates candidates, resets voting state, and activates the next round.

```ts
export const transitionToNextRound = functions.https.onCall(async (data, context) => {
  // 1. Admin-only authorization check
  // 2. Get current round config
  // 3. If current round has elimination:
  //    a. Count endorsements/votes per candidate for THIS round
  //    b. Sort candidates by count
  //    c. Take top N (candidatesAdvancing) — mark the rest as eliminated
  //    d. Set eliminatedAt, eliminatedInRound, eliminationReason on eliminated candidates
  // 4. Mark current round as isComplete: true, isActive: false
  // 5. Mark next round as isActive: true
  // 6. Update partyConfig.currentRoundId and partyConfig.contestStage
  // 7. Send push notifications to all verified users
  // 8. Log to audit trail
});
```

### Elimination logic (per voting method)

```ts
function eliminateCandidates(
  roundConfig: ContestRound,
  candidates: Candidate[],
  endorsements: Endorsement[],  // or votes: Vote[]
): { advancing: string[], eliminated: string[] } {
  const advancing = roundConfig.candidatesAdvancing;

  switch (roundConfig.votingMethod) {
    case 'approval':
      // Count endorsements per candidate in this round
      // Sort by count descending
      // Top N advance, rest eliminated
      break;

    case 'ranked_choice':
      // Implement instant-runoff or Borda count
      // Eliminate lowest-ranked candidate iteratively
      // Until N candidates remain
      break;

    case 'pick_one':
      // Count votes per candidate
      // Candidate with 50%+ wins
      // If no majority: runoff logic (TBD)
      break;
  }
}
```

### Beta cron function (`functions/src/cron/advanceContestRound.ts`)

During the beta, advances the round daily on a schedule. See PLAN-11 for the implementation — updated here to use the new round transition function:

```ts
export const advanceContestRoundDaily = functions.pubsub
  .schedule('0 0 * * *')
  .timeZone('America/New_York')
  .onRun(async () => {
    // 1. Get current round from partyConfig
    // 2. Get ordered round list from contestRounds collection
    // 3. Find next round
    // 4. Call transitionToNextRound logic (without elimination for beta)
    //    - In beta mode, skip elimination — just advance the round
    //    - This lets users see the UI change without losing candidates
    // 5. Log the advancement
  });
```

**Beta vs production behavior:**
- **Beta:** Cron advances rounds daily, skips elimination (candidates persist through all rounds for demo purposes)
- **Production:** Admin triggers `transitionToNextRound` manually, elimination is enforced

## Client-Side Round-Aware Behavior

### Query filtering by round

Candidate queries must filter out eliminated candidates:

```ts
// Current: queries all approved candidates
.where('status', '==', 'approved')

// Updated: also exclude eliminated candidates
.where('status', '==', 'approved')
.where('eliminatedAt', '==', null)  // Only active (non-eliminated) candidates
```

**Note:** Firestore doesn't support `!= null` well. Alternative approach: add `isEliminated: boolean` field (default `false`) to Candidate, set to `true` on elimination. Query with `.where('isEliminated', '==', false)`.

### Endorsement/vote submission

The UI must pass the current `roundId` when creating endorsements or votes:

```ts
// In userStore or service layer:
const endorseCandidate = async (odid: string, candidateId: string) => {
  const currentRoundId = useConfigStore.getState().partyConfig?.currentRoundId;
  await createEndorsement(odid, candidateId, currentRoundId);
};
```

### Voting method UI adaptation

Components that show endorse/vote buttons must check the current voting method:

```ts
const votingMethod = useConfigStore(selectVotingMethod);
const canVote = useConfigStore(selectCanVote);

// Render different UIs based on voting method:
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
    eliminationThreshold: null,
    startDate: null,
    endDate: null,
    isActive: true,   // Default starting round
    isComplete: false,
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
    eliminationThreshold: null, // Determined by top-N, not a fixed threshold
    startDate: null,
    endDate: null,
    isActive: false,
    isComplete: false,
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
    eliminationThreshold: null,
    startDate: null,
    endDate: null,
    isActive: false,
    isComplete: false,
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
    eliminationThreshold: null,
    startDate: null,
    endDate: null,
    isActive: false,
    isComplete: false,
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
    eliminationThreshold: null,
    startDate: null,
    endDate: null,
    isActive: false,
    isComplete: false,
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
    eliminationThreshold: null, // 50%+ majority
    startDate: null,
    endDate: null,
    isActive: false,
    isComplete: false,
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
    eliminationThreshold: null,
    startDate: null,
    endDate: null,
    isActive: false,
    isComplete: false,
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
    eliminationThreshold: null,
    startDate: null,
    endDate: null,
    isActive: false,
    isComplete: false,
  },
];
```

## Migration Path

### Phase 1 (Current sprint — content only)
- Add `ContestRoundId` and `ContestRound` types
- Seed `contestRounds` collection
- Add `currentRoundId` to `PartyConfig` (keep `contestStage` as alias)
- Update `configStore` with new selectors
- Wire round state to FAQs (PLAN-11), About the Contest timeline (PLAN-16), and explainer text
- Implement beta cron (daily round advance, no elimination)
- **No elimination, no voting method changes, no round-scoped endorsements yet**

### Phase 2 (Next sprint — elimination)
- Add `roundId` to Endorsement type and creation logic
- Add `isEliminated` boolean + `eliminatedAt`/`eliminatedInRound` to Candidate type
- Update all candidate queries to filter `isEliminated === false`
- Implement `transitionToNextRound` Cloud Function with elimination
- Update leaderboard to show round-specific endorsement counts
- Update For You feed to hide eliminated candidates

### Phase 3 (Future — voting methods)
- Add `Vote` type and `votes` collection
- Implement ranked-choice voting UI and tallying
- Implement pick-one voting UI
- Add `selectVotingMethod` selector to drive UI changes
- Build round-specific voting components

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
- Beta cron advances rounds daily
- About the Contest timeline highlights the correct round
- FAQs change per round
- `selectVotingMethod`, `selectCanVote`, `selectIsEndorsementRound` return correct values for each round

### Phase 2
- Round transition eliminates correct candidates (bottom N)
- Eliminated candidates no longer appear in feed, leaderboard, or search
- Endorsements are tagged with `roundId`
- Round-specific endorsement counts are accurate
- Audit log captures every transition and elimination

### Phase 3
- Ranked-choice UI renders with draggable candidate ordering
- Pick-one UI renders with radio selection
- Vote tallying produces correct results per method
- Round transition uses correct tallying method
