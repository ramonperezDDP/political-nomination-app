# PLAN: Dynamic FAQs Based on Contest Round ✅ IMPLEMENTED

> **Status:** Implemented as part of PLAN-00 Phase 1. See `src/constants/faqs.ts` and `src/components/home/VoterHome.tsx`.

> **Depends on:** [PLAN-00: Contest Round Architecture](./PLAN-00-contest-round-architecture.md) — uses `ContestRoundId`, `ContestRound`, `currentRoundId`, and the `contestRounds` collection defined there.

## Summary

FAQ content should change depending on the current contest round (Endorsement Rounds 1-3, Virtual Town Hall, Debate, Final Results). Specific FAQ content for each round is provided in the feedback document.

**Key requirement:** The contest round must be driven by a **global state** that updates in real-time when an admin changes the round. All users see the same contest round regardless of when they signed up — a user joining during Round 3 sees Round 3 content immediately.

**Beta test approach:** During the beta, contest rounds will advance **automatically via a cron job on a daily schedule** to demonstrate the full nomination contest lifecycle to users. In production, an admin will control round advancement manually.

## Current State (after implementation)

- FAQs are dynamic, loaded from `src/constants/faqs.ts` via `getFaqsForRound(currentRoundId)`
- `VoterHome.tsx` reads `currentRoundId` from configStore and passes it to `getFaqsForRound()`
- Contest round stored in `partyConfig.currentRoundId` (configStore selector: `selectCurrentRoundId`)
- 8 round IDs defined as `ContestRoundId` type in `src/types/index.ts`
- `configStore.ts` subscribes to `partyConfig` in real-time via `onSnapshot` and derives `currentRound`

## Files Modified

- `src/components/home/VoterHome.tsx` — hardcoded FAQs replaced with dynamic lookup
- `src/types/index.ts` — `ContestRoundId` type added per PLAN-00
- `src/stores/configStore.ts` — `currentRound` derived state, `fetchContestRounds()`, and new selectors added

## Files Created

- `src/constants/faqs.ts` — FAQ content organized by round ID
- `functions/src/cron/advanceContestRound.ts` — Cloud Function on a daily cron schedule to advance the contest round during the beta

## Implementation Details

### 1\. Use ContestRoundId from PLAN-00 (`src/types/index.ts`)

Replace the current 4-value `ContestStage` type with the full `ContestRoundId` type defined in PLAN-00:

```ts
export type ContestRoundId =
  | 'pre_nomination'
  | 'round_1_endorsement'
  | 'round_2_endorsement'
  | 'round_3_endorsement'
  | 'virtual_town_hall'
  | 'debate'
  | 'final_results'
  | 'post_election';

// Backward-compatible alias
export type ContestStage = ContestRoundId;
```

### 2\. Create FAQ constants file (`src/constants/faqs.ts`)

FAQs are keyed by `ContestRoundId`. The three endorsement rounds share the same FAQ set since the voting method is the same (approval voting). Later rounds have distinct FAQs reflecting their different voting methods.

```ts
import type { ContestRoundId } from '@/types';

interface FAQ {
  id: string;
  question: string;
  answer: string;
}

export const FAQ_BY_ROUND: Partial<Record<ContestRoundId, FAQ[]>> = {
  // Shared by all three endorsement rounds
  round_1_endorsement: [
    {
      id: 'how-endorsements',
      question: 'How do the Endorsement rounds work?',
      answer:
        'During this stage citizens are allowed to endorse all potential nominees who they want to advance to the next round. This is Approval Voting.',
    },
    {
      id: 'find-candidates',
      question: 'How can I find contestants to endorse?',
      answer:
        'All prospective candidates are required to state their position on seven issues for the upcoming Congressional term. Answer the quiz for issues that matter to you and find those who match, or go to the For You page.',
    },
    {
      id: 'submit-endorsements',
      question: 'How do I submit my endorsements?',
      answer:
        'You can bookmark your favorite candidates and endorse them all at once, or one at a time. The app will require ID verification each time endorsements are submitted. Once transmitted, your endorsements for that round cannot be changed.',
    },
  ],

  virtual_town_hall: [
    {
      id: 'new-content',
      question: 'Does the Virtual Town Hall offer any new content?',
      answer:
        'Yes. The remaining four contestants will provide video responses to additional questions as determined by a local committee.',
    },
    {
      id: 'weigh-in',
      question: 'How do I weigh in?',
      answer:
        'Citizens submit their ranking of the four remaining potential nominees. The top two advance to a final debate.',
    },
    {
      id: 'voting-methods',
      question: 'What voting methods will be evaluated?',
      answer:
        'Ranked Choice, STAR, Pick Two and Approval. More information can be found on our website.',
    },
  ],

  debate: [
    {
      id: 'watch-debate',
      question: 'Will I have to watch the live debate on my app?',
      answer:
        'No. The local committee will moderate and record the debate. Citizens watch it at their convenience.',
    },
    {
      id: 'choose-method',
      question: 'What method will be used to choose the candidate?',
      answer:
        'Citizens will pick one of the two remaining potential nominees. The party candidate wins the nomination with at least 50% support.',
    },
  ],

  final_results: [
    {
      id: 'find-results',
      question: 'Where can I find the results?',
      answer:
        'Results are available by round: First Round (100), Second Round (20), Third Round (10), Virtual Town Hall (4), Debate (2). Tap each round to see complete results.',
    },
    {
      id: 'audited',
      question: 'Will the results be audited?',
      answer:
        'The party audits the results and verifies that all contest rules were adhered to while citizens work virtual polling locations to monitor activity.',
    },
  ],
};

// Endorsement rounds 2 and 3 share the same FAQs as round 1
FAQ_BY_ROUND.round_2_endorsement = FAQ_BY_ROUND.round_1_endorsement;
FAQ_BY_ROUND.round_3_endorsement = FAQ_BY_ROUND.round_1_endorsement;

// Fallback for pre_nomination, post_election, or unknown rounds
export const DEFAULT_FAQS: FAQ[] = FAQ_BY_ROUND.round_1_endorsement!;

export function getFaqsForRound(roundId: ContestRoundId | string): FAQ[] {
  return FAQ_BY_ROUND[roundId as ContestRoundId] || DEFAULT_FAQS;
}
```

### 3\. Update VoterHome to use dynamic FAQs (`src/components/home/VoterHome.tsx`)

```ts
// Replace hardcoded faqs array (lines 43-68) with:
import { getFaqsForRound } from '@/constants/faqs';

// Inside component — use currentRoundId from PLAN-00's updated PartyConfig:
const currentRoundId = useConfigStore(
  (state) => state.partyConfig?.currentRoundId || 'pre_nomination'
);
const faqs = getFaqsForRound(currentRoundId);
```

The rest of the FAQ rendering code (lines 152-180) remains unchanged since it already iterates over the `faqs` array.

### 4\. Global contest round state with real-time updates (`src/stores/configStore.ts`)

The existing `configStore` already subscribes to `partyConfig` via `onSnapshot` (confirmed in `firestore.ts:1842-1860`). When the admin or cron updates `partyConfig.currentRoundId`, the listener fires and all connected clients receive the new round immediately.

Per PLAN-00, extend `configStore` to also load the `contestRounds` collection and derive `currentRound`:

```ts
// In initialize():
// 1. Subscribe to partyConfig (existing)
// 2. Fetch contestRounds collection (new)
get().fetchContestRounds();

// New method:
fetchContestRounds: async () => {
  const rounds = await getContestRounds(); // New Firestore helper
  const currentRoundId = get().partyConfig?.currentRoundId;
  set({
    contestRounds: rounds,
    currentRound: rounds.find(r => r.id === currentRoundId) || null,
  });
},
```

When `partyConfig` updates (via the existing `onSnapshot` subscription), re-derive `currentRound`:

```ts
const unsubscribe = subscribeToPartyConfig((config) => {
  const currentRound = get().contestRounds.find(r => r.id === config?.currentRoundId) || null;
  set({ partyConfig: config, currentRound, isLoading: false });
});
```

### 5\. Beta cron job for daily round advancement (`functions/src/cron/advanceContestRound.ts`)

Uses the `contestRounds` collection (PLAN-00) to determine round order, and advances by updating `partyConfig.currentRoundId`. During beta, **no elimination** — candidates persist for demo purposes.

```ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Runs every day at midnight ET during the beta
export const advanceContestRound = functions.pubsub
  .schedule('0 0 * * *')
  .timeZone('America/New_York')
  .onRun(async () => {
    const db = admin.firestore();

    // 1. Get current round from partyConfig
    const configRef = db.doc('config/partyConfig');
    const configSnap = await configRef.get();
    const currentRoundId = configSnap.data()?.currentRoundId || 'pre_nomination';

    // 2. Get ordered rounds from contestRounds collection
    const roundsSnap = await db.collection('contestRounds').orderBy('order').get();
    const rounds = roundsSnap.docs.map(d => d.data());

    // 3. Find next round
    const currentIndex = rounds.findIndex(r => r.id === currentRoundId);
    if (currentIndex < 0 || currentIndex >= rounds.length - 1) {
      console.log('Contest is complete or stage not found, no advancement.');
      return;
    }

    const nextRound = rounds[currentIndex + 1];

    // 4. Advance (no elimination in beta)
    const batch = db.batch();
    // Mark current round complete
    batch.update(db.doc(`contestRounds/${currentRoundId}`), {
      isActive: false,
      isComplete: true,
    });
    // Activate next round
    batch.update(db.doc(`contestRounds/${nextRound.id}`), {
      isActive: true,
    });
    // Update partyConfig
    batch.update(configRef, {
      currentRoundId: nextRound.id,
      contestStage: nextRound.id, // Backward compatibility
    });
    await batch.commit();

    console.log(`Advanced contest round from ${currentRoundId} to ${nextRound.id}`);
  });
```

Register in `functions/src/index.ts`:

```ts
export { advanceContestRound } from './cron/advanceContestRound';
```

**Important:** The contest round is global — all users see the same round. A user signing up on day 3 of the beta will enter the contest at whatever round is current on that day. There is no per-user round progression.

## Testing

- Set `partyConfig.currentRoundId` to each round ID in Firestore and verify FAQs change
- `round_1_endorsement`, `round_2_endorsement`, `round_3_endorsement` all show the same 3 endorsement FAQs
- `virtual_town_hall` shows 3 FAQs about rankings
- `debate` shows 2 FAQs about final selection
- `final_results` shows 2 FAQs about results and auditing
- `pre_nomination` and `post_election` fall back to endorsement FAQs
- Changing `currentRoundId` in Firestore console reflects immediately in the app (real-time via `onSnapshot`)
- Cron function advances the round correctly and updates both `currentRoundId` and `contestStage`
- Cron marks the previous round as `isComplete: true`
- New users joining mid-contest see the current round's FAQs immediately
