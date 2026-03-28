# PLAN-10E: Eliminate Priority Issues — Pure Quiz-Based Matching

> **Status: ✅ COMPLETE (2026-03-28).** Priority issues removed from matching. Pure quiz-based scoring live. 3-tier alignment chips (exact/close/not matched) on candidate profile. Issues tab rewritten as quiz answer comparison. Alignment tooltip modal removed — breakdown shown inline. Step 2 (POSITION_TEMPLATES deletion) pending.
>
> **Depends on:** PLAN-10C (complete), PLAN-10D (complete)

## Summary

Remove the "priority issues" concept from matching. Candidates and voters fill out the exact same quiz questionnaire and are matched purely on spectrum closeness of their quiz answers. No priority rankings, no issue overlap ratio, no priority bonus scoring.

**Single explainable user story:** "You and the candidate answered the same questions. We compare how close your answers are."

**Important distinction (from review):** Removing `topIssues` from *matching* does not mean removing richer candidate policy content from the product forever. The quiz is the matching instrument. Candidates may still have additional policy profile content in the future — but that content would be for exploration/display, not for scoring.

## What's Being Removed

The current system has two parallel matching concepts:

1. **Priority Issues (`topIssues`)** — Each candidate has a ranked list of ~31 issues with `priority: number` (1 = most important) and `spectrumPosition`. Alignment scoring uses priority rankings for overlap ratio and bonus points.

2. **Quiz Responses (`questionnaireResponses`)** — Both candidates and voters answer the same 7 multiple-choice questions. Each answer maps to a spectrum value.

These overlap and create confusion: the alignment tooltip says "0 of 7 priority issues match" while the shared policy chips show 3 matches because they use different matching logic.

**After this change:** Only quiz responses are used for matching. `topIssues` stops being read for scoring (field remains in Firestore, harmless).

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

**New interface (uses `questionId`, not `issueId`, per review):**
```ts
interface AlignmentInput {
  candidateResponses: Array<{ questionId: string; issueId: string; answer: number }>;
  userResponses: Array<{ questionId: string; issueId: string; answer: number }>;
}

interface AlignmentResult {
  score: number | null;       // 0-100, null if no shared answers
  sharedCount: number;        // how many questions both answered
  totalQuestions: number;      // total active quiz questions
  alignedQuestionIds: string[]; // questionIds where closeness >= 0.75 (for chips)
}
```

Responses keyed by `questionId` (consistent with PLAN-10C's normalized model). `issueId` still carried for display grouping but not used as the matching key.

**Example:**
- User: Trade = -80, Iran = -80, Inflation = -70
- Candidate: Trade = -75, Iran = 0, Inflation = -65
- Trade closeness: 1 - 5/200 = 0.975
- Iran closeness: 1 - 80/200 = 0.6
- Inflation closeness: 1 - 5/200 = 0.975
- Average: 0.85 → **Score: 85%**

## Shared Policy Chip Rules (from review)

Chips on For You cards and candidate detail show specific policies where user and candidate are closely aligned. Explicit rules:

- **Show chip** when closeness ≥ 0.75 (same direction AND reasonably close)
- Chip shows the issue name (e.g., "Trade", "Welfare")
- Styled with district color (pink PA-01, blue PA-02)
- If closeness is 0.5–0.74: not shown as chip (contributes to score but not highlighted)
- If closeness < 0.5: not shown and pulls score down

This means a chip labeled "Trade" indicates genuine agreement, not just "both answered this question."

## Null / Low-Data Behavior (from review)

| State | My Issues filter | For You card | Candidate detail |
|-------|-----------------|--------------|-----------------|
| User answered 0 questions | Filter unavailable (gated by `selectCanSeeAlignment`) | No score shown, "Top issues:" fallback | "Complete the quiz to see your match" |
| User answered 1+ questions, candidate answered 0 | Candidate excluded from My Issues (per PLAN-10C) | N/A (excluded) | "This candidate hasn't answered yet" |
| User answered 1+ questions, candidate answered 1+ but no overlap | Score shown (may be low), no chips | Score + "Top issues:" fallback | Score shown, no "Shared Positions" |
| Both answered, some overlap | Score shown, shared policy chips | Score + "Shares my position on:" chips | Score + side-by-side comparison |

**Sorting with null scores:** Candidates with null scores sort to the end of My Issues (effectively hidden since the filter excludes them per PLAN-10C).

## Candidate Completeness (restate from PLAN-10C)

Per PLAN-10C decision: **candidates are hidden from "My Issues" filter until they answer active questions.** This means:
- Candidates with 0 quiz responses → excluded from My Issues, visible in My Area
- Candidates with partial responses → included in My Issues (scored on answered overlap only)
- No minimum coverage threshold beyond "at least 1 answer"

## Alignment Tooltip Language (from review)

Do NOT say "X of 7 policy positions match" — that implies binary match/mismatch.

Instead: **"Alignment based on X shared responses"** — reflects the continuous closeness model.

Example tooltip content:
```
85% Overall Match
Alignment based on 5 shared responses

Shared Positions:
[Trade] [Inflation] [Welfare]
```

## Files to Modify

### 1. `src/utils/alignment.ts`

Rewrite `calculateAlignmentScore`:

**Remove:** `candidateIssues`, `userIssues`, `candidatePositions` params. Remove issue overlap, priority bonus, base points.

**New:** Accept `candidateResponses` and `userResponses` keyed by `questionId`. Return `score`, `sharedCount`, `totalQuestions`, `alignedQuestionIds`.

### 2. `app/(main)/(feed)/index.tsx`

Update `generateFeedItem`:
- Remove `userIssues` param
- Pass candidate's `questionnaireResponses` to alignment scoring
- FeedItem carries derived presentation data: `alignmentScore`, `sharedCount`, `alignedQuestionIds`, `candidateResponses`

**FeedItem should contain derived alignment presentation data** (from review), not just raw responses. UI components should be presentation-only and not recompute matching logic.

### 3. `src/types/index.ts` and `src/types/index.web.ts`

Update `FeedItem`:
- Remove `matchedIssues: string[]`
- Remove `candidatePositions: TopIssue[]`
- Add `candidateResponses: QuestionnaireResponse[]`
- Add `sharedCount: number`
- Add `alignedQuestionIds: string[]`

`Candidate.topIssues`: keep field (backward compat) but not used for matching.

### 4. `src/screens/CandidateDetailScreen.tsx`

- Alignment tooltip: use new language ("Alignment based on X shared responses")
- Issues tab rewrite: show side-by-side quiz answer comparison per question
  - If user hasn't answered: show candidate answer only, no comparison implied
  - If candidate hasn't answered: show "No response yet"
  - Only show active quiz questions (not retired historical answers)
- Remove priority ranking display

### 5. `src/components/feed/FullScreenPSA.tsx`

- `sharedPolicies`: derive from `feedItem.alignedQuestionIds` (pre-computed, no local recomputation)
- Remove `candidatePositions` usage

### 6. `src/services/firebase/firestore.ts` and `firestore.web.ts`

Two-step migration (from review):
1. **Step 1:** Stop using `topIssues` in runtime matching/UI
2. **Step 2:** Remove generation code (`POSITION_TEMPLATES`, `generateAllIssuePositions`, `ALL_ISSUE_IDS`) after confirming no seed paths depend on them

### 7. Copy / Analytics Audit (from review)

Same discipline as PLAN-10A:
- String audit: find all user-facing text referencing "priority issues", "top issues" as a matching concept, "issue overlap"
- Analytics audit: any events/funnels named after priority-issue concepts
- Explainer audit: "match" vs "closeness" wording consistency
- Tooltip/help text audit

## What Does NOT Change

- Quiz screen (`app/(main)/quiz.tsx`) — unchanged
- QuizCard on home screen — unchanged
- QuizBottomSheet — unchanged
- Firestore question/quiz config model — unchanged
- The `questionnaireResponses` data model — unchanged

## Seed Data Impact

- `POSITION_TEMPLATES` (5 leanings × 31 issues) deleted in Step 2 — ~400 lines
- `generateAllIssuePositions` function deleted in Step 2 — ~30 lines
- `ALL_ISSUE_IDS` array deleted in Step 2 — ~10 lines
- Candidates' `topIssues` field remains in Firestore (harmless, not read for matching)
- Auto-reseed migration check in feed simplified

## Testing

- [ ] Alignment score computed purely from shared quiz answers (no priority overlap/bonus)
- [ ] Score = null when no shared answers
- [ ] Alignment tooltip says "Alignment based on X shared responses" (not "X match")
- [ ] Shared policy chips appear only when closeness ≥ 0.75
- [ ] Candidate detail Issues tab shows side-by-side quiz answer comparison
- [ ] Candidate with 0 answers: excluded from My Issues, visible in My Area
- [ ] Candidate with 0 answers: detail page shows "hasn't answered yet"
- [ ] User with 0 answers: My Issues filter unavailable
- [ ] No user-facing references to "priority issues"
- [ ] Feed My Issues filter sorts by alignment score
- [ ] FeedItem carries pre-computed presentation data (sharedCount, alignedQuestionIds)
- [ ] Seed candidates still get quiz responses and alignment works

## Estimated Impact

- ~500 lines removed (position templates, priority logic) — in Step 2
- ~100 lines rewritten (alignment scoring, feed generation, detail screen)
- Simpler mental model: one questionnaire, one matching formula
