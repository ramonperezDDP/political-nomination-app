# PLAN-10E: Eliminate Priority Issues — Pure Quiz-Based Matching

> **Status:** Ready for review.
>
> **Depends on:** PLAN-10C (complete), PLAN-10D (complete)

## Summary

Remove the "priority issues" concept entirely. Candidates and voters fill out the exact same quiz questionnaire and are matched purely on spectrum closeness of their quiz answers. No priority rankings, no issue overlap ratio, no priority bonus scoring.

## What's Being Removed

The current system has two parallel matching concepts:

1. **Priority Issues (`topIssues`)** — Each candidate has a ranked list of ~31 issues with `priority: number` (1 = most important) and `spectrumPosition`. Alignment scoring uses priority rankings for overlap ratio and bonus points.

2. **Quiz Responses (`questionnaireResponses`)** — Both candidates and voters answer the same 7 multiple-choice questions. Each answer maps to a spectrum value.

These overlap and create confusion: the alignment tooltip says "0 of 7 priority issues match" while the shared policy chips show 3 matches because they use different matching logic.

**After this change:** Only quiz responses exist. Candidates and voters are matched solely on their quiz answers via spectrum closeness.

## New Alignment Scoring

Replace `calculateAlignmentScore` with a simpler formula based purely on quiz responses:

```
For each quiz question both user and candidate have answered:
  closeness = 1 - |userAnswer - candidateAnswer| / 200

alignmentScore = average(closeness values) * 100
```

- No issue overlap ratio (removed — no priority issues)
- No priority bonus (removed — no priority rankings)
- No base 10 points (removed — score is purely data-driven)
- Unanswered questions excluded from the average
- If no shared answers: score = null

**Example:**
- User: Trade = -80, Iran = -80, Inflation = -70
- Candidate: Trade = -75, Iran = 0, Inflation = -65
- Trade closeness: 1 - 5/200 = 0.975
- Iran closeness: 1 - 80/200 = 0.6
- Inflation closeness: 1 - 5/200 = 0.975
- Average: 0.85 → **Score: 85%**

## Files to Modify

### 1. `src/utils/alignment.ts`

Rewrite `calculateAlignmentScore`:

**Remove:**
- `candidateIssues` and `userIssues` params (no priority issues)
- `candidatePositions` param (no priority list)
- Issue overlap ratio calculation
- Priority bonus calculation
- Base 10 points

**Keep:**
- `userResponses` param
- Spectrum closeness math

**New interface:**
```ts
interface AlignmentInput {
  candidateResponses: Array<{ issueId: string; answer: number }>;
  userResponses: Array<{ issueId: string; answer: number }>;
}

interface AlignmentResult {
  score: number | null;  // 0-100, null if no shared answers
  sharedCount: number;   // how many questions both answered
  totalQuestions: number; // total active quiz questions
}
```

### 2. `app/(main)/(feed)/index.tsx`

Update `generateFeedItem`:
- Remove `userIssues` param (no selected issues)
- Pass candidate's `questionnaireResponses` (from the candidate's user doc) instead of `topIssues` to alignment scoring
- Remove `candidatePositions` from FeedItem (no longer needed — shared policies are computed in FullScreenPSA from candidate responses)
- Remove `matchedIssues` from FeedItem

### 3. `src/types/index.ts` and `src/types/index.web.ts`

Update `FeedItem`:
- Remove `matchedIssues: string[]`
- Remove `candidatePositions: TopIssue[]`
- Add `candidateResponses: QuestionnaireResponse[]`

Update `Candidate`:
- `topIssues` becomes optional/deprecated (keep for backward compat during migration, but not used for matching)

### 4. `src/screens/CandidateDetailScreen.tsx`

- Alignment tooltip: already fixed to use spectrum closeness (this commit)
- Issues tab: currently shows candidate's `topIssues` with spectrum sliders. Replace with candidate's quiz answers displayed as their selected option per question
- Remove priority ranking display (#1, #2, #3 etc.)

### 5. `src/components/feed/FullScreenPSA.tsx`

- `sharedPolicies` computation: change from iterating `candidatePositions` (topIssues) to iterating `candidateResponses` (quiz answers)
- Remove `candidatePositions` from feedItem destructuring

### 6. `src/services/firebase/firestore.ts` and `firestore.web.ts`

- `getCandidatesForFeed`: ensure candidate user docs (with `questionnaireResponses`) are returned alongside candidate docs
- `seedCandidates`: candidates already get `questionnaireResponses` from PLAN-10C. No change needed for seeding.
- `POSITION_TEMPLATES` and `generateAllIssuePositions`: can be removed entirely (only used for generating `topIssues`)
- `ALL_ISSUE_IDS`: can be removed (only used by position generation)

### 7. `src/stores/configStore.ts`

- Remove or simplify any selectors that reference priority issues

### 8. Candidate detail — Issues tab rewrite

Currently shows a ranked list with spectrum position sliders. Replace with:

```
Question: "What tariff policy should apply to foreign goods?"
Candidate's answer: [Protection] — highlighted
Your answer: [Free Trade] — highlighted differently
```

Shows each quiz question with both the candidate's and user's selected options, making it easy to see where they agree and disagree.

## What Does NOT Change

- Quiz screen (`app/(main)/quiz.tsx`) — unchanged
- QuizCard on home screen — unchanged
- QuizBottomSheet — unchanged
- Firestore question/quiz config model — unchanged
- The `questionnaireResponses` data model — unchanged

## Seed Data Impact

- `POSITION_TEMPLATES` (5 leanings × 31 issues) can be deleted — ~400 lines
- `generateAllIssuePositions` function can be deleted — ~30 lines
- `ALL_ISSUE_IDS` array can be deleted — ~10 lines
- Candidates' `topIssues` field will still exist in Firestore but won't be used for matching
- Auto-reseed migration check in feed can be simplified (no more wrong-district position checks)

## Testing

- [ ] Alignment score is computed purely from shared quiz answers
- [ ] Score = null when no shared answers (user hasn't taken quiz)
- [ ] Alignment tooltip shows "X of 7 policy positions match"
- [ ] Shared policy chips on For You cards still work (using candidateResponses)
- [ ] Candidate detail Issues tab shows quiz answers comparison (not priority ranking)
- [ ] No references to "priority issues" in UI
- [ ] Feed "My Issues" filter still sorts by alignment score
- [ ] Seed candidates still get quiz responses and alignment works

## Estimated Impact

- ~500 lines removed (position templates, priority logic)
- ~100 lines rewritten (alignment scoring, feed generation, detail screen)
- Simpler mental model: one questionnaire, one matching formula
