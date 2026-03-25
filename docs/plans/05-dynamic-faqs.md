# PLAN: Dynamic FAQs Based on Contest Round

## Summary
FAQ content should change depending on the current contest round (Endorsement, Virtual Town Hall, Debate, Final Results). Specific FAQ content for each round is provided in the feedback document.

## Current State
- FAQs are hardcoded in `src/components/home/VoterHome.tsx:43-68`
- 4 static FAQs: endorsements, alignment score, dealbreakers, voting
- Contest stage stored in `partyConfig.contestStage` (configStore selector: `selectContestStage`)
- Possible stages defined in `src/types/index.ts`: `'pre_nomination' | 'nomination' | 'voting' | 'post_election'`

## Files to Modify
- `src/components/home/VoterHome.tsx` — replace hardcoded FAQs with dynamic lookup
- `src/types/index.ts` — add new contest stages if needed

## Files to Create
- `src/constants/faqs.ts` — FAQ content organized by round

## Implementation Details

### 1. Extend ContestStage type (`src/types/index.ts`)

```typescript
// Current (line ~295):
export type ContestStage = 'pre_nomination' | 'nomination' | 'voting' | 'post_election';

// Updated:
export type ContestStage =
  | 'pre_nomination'
  | 'endorsement'       // Round 1: Approval voting
  | 'virtual_town_hall' // Round 2: Ranked choice
  | 'debate'            // Round 3: Pick one
  | 'final_results'     // Results display
  | 'post_election';
```

### 2. Create FAQ constants file (`src/constants/faqs.ts`)

```typescript
import type { ContestStage } from '@/types';

interface FAQ {
  id: string;
  question: string;
  answer: string;
}

export const FAQ_BY_ROUND: Record<string, FAQ[]> = {
  endorsement: [
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

// Fallback for pre_nomination or unknown stages
export const DEFAULT_FAQS: FAQ[] = FAQ_BY_ROUND.endorsement;

export function getFaqsForStage(stage: ContestStage | string): FAQ[] {
  return FAQ_BY_ROUND[stage] || DEFAULT_FAQS;
}
```

### 3. Update VoterHome to use dynamic FAQs (`src/components/home/VoterHome.tsx`)

```typescript
// Replace hardcoded faqs array (lines 43-68) with:
import { getFaqsForStage } from '@/constants/faqs';
import { selectContestStage } from '@/stores';

// Inside component:
const contestStage = useConfigStore(selectContestStage);
const faqs = getFaqsForStage(contestStage);
```

The rest of the FAQ rendering code (lines 152-180) remains unchanged since it already iterates over the `faqs` array.

## Testing
- Set `partyConfig.contestStage` to each stage in Firestore and verify FAQs change
- Endorsement round shows 3 FAQs about approval voting
- Virtual Town Hall shows 3 FAQs about rankings
- Debate shows 2 FAQs about final selection
- Final Results shows 2 FAQs about results and auditing
- Default/fallback shows endorsement FAQs
