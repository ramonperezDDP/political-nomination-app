# PLAN: Quiz Improvements ✅ PARTIALLY IMPLEMENTED

> **Status:** Dealbreaker removal complete. Quiz deselect capability added. Remaining: direct quiz launch from home (skip issues screen), Global/National/Local grouping.

## Summary

- Keep the existing auto-save behavior (saves immediately when user selects a policy option) — no separate save button needed
- Remove the extra navigation screen between the quiz modal on the home screen and the policy-choice popup. Users should tap the quiz modal and immediately see the popup where they choose their policy options
- Allow users to deselect a previously chosen option so it returns to unfilled/blank
- Organize the policy sections in the home screen quiz modal into three groups: **Global**, **National**, and **Local**
- **Remove the dealbreakers concept entirely** from the quiz flow and the app — remove all filters, popups, screens, and references to dealbreakers
- "Take the Quiz" label toggles to "Change the Quiz" once completed

## Current State

- Quiz lives in `app/(auth)/onboarding/questionnaire.tsx` (365 lines) — multi-step flow: issues selection → questionnaire → dealbreakers
- There is an intermediate issues selection screen (`app/(auth)/onboarding/issues.tsx`) that stands between the home screen and the actual quiz popup — this extra step needs to be removed
- Questions loaded from Firestore based on selected issues (lines 31-63)
- Responses auto-saved via `useUserStore().updateQuestionnaireResponses()` (line 104) — this behavior is correct and should be kept
- Dealbreakers screen at `app/(auth)/onboarding/dealbreakers.tsx` with 12 hardcoded options (max 3 per user) — this entire concept is being removed
- Dealbreakers settings at `app/settings/dealbreakers.tsx` — also being removed
- Dealbreaker filtering exists in For You page (`app/(tabs)/for-you.tsx`) as a `no-dealbreakers` filter option
- Alignment calculation in `src/utils/alignment.ts` checks `hasDealbreaker` based on spectrum position > 80
- Quiz label on homepage is hardcoded "Policy Preferences" in `VoterHome.tsx:28`

## Files to Modify

- `app/(auth)/onboarding/questionnaire.tsx` — remove navigation to dealbreakers, add deselect capability
- `src/components/home/VoterHome.tsx` — toggle quiz label, launch quiz popup directly (skip issues screen), organize policy sections by Global/National/Local
- `app/(tabs)/for-you.tsx` — remove the `no-dealbreakers` filter option
- `src/utils/alignment.ts` — remove `hasDealbreaker` from alignment calculation
- `src/stores/userStore.ts` — remove `updateDealbreakers()` method and `dealbreakers` field usage
- `src/types/index.ts` — remove dealbreaker-related type fields from User type
- `app/settings/_layout.tsx` — remove dealbreakers route
- `app/(tabs)/profile.tsx` — remove "Manage Dealbreakers" menu item
- `src/components/feed/PSACard.tsx` — remove dealbreaker badge display
- `app/candidate/[id].tsx` — remove dealbreaker warning from alignment explainer modal

## Files to Delete

- `app/(auth)/onboarding/dealbreakers.tsx` — entire dealbreakers onboarding screen
- `app/settings/dealbreakers.tsx` — entire dealbreakers settings screen

## Implementation Details

### 1\. Remove dealbreakers throughout the codebase

**Remove from types (`src/types/index.ts`):**
- Remove `dealbreakers: string[]` from User interface
- Remove any DealbreakersOption type definitions

**Remove from userStore (`src/stores/userStore.ts`):**
- Remove `updateDealbreakers()` method
- Remove any dealbreaker validation logic (max 3 validation, etc.)

**Remove from alignment calculation (`src/utils/alignment.ts`):**
- Remove `userDealbreakers` parameter from `calculateAlignmentScore()`
- Remove `hasDealbreaker` from the return object
- Remove the spectrum position > 80 check

**Remove from For You feed (`app/(tabs)/for-you.tsx`):**
- Remove `no-dealbreakers` from the filter menu options
- Remove any dealbreaker-related filtering logic

**Remove from PSACard (`src/components/feed/PSACard.tsx`):**
- Remove dealbreaker badge/icon display on candidate cards

**Remove from candidate detail (`app/candidate/[id].tsx`):**
- Remove dealbreaker warning section from alignment explainer modal (lines 548-559)
- Remove `userDealbreakers` from the alignment calculation call

**Remove from navigation:**
- `app/settings/_layout.tsx` — remove the `dealbreakers` Screen entry
- `app/(tabs)/profile.tsx` — remove "Manage Dealbreakers" menu item and navigation
- `app/(auth)/onboarding/questionnaire.tsx` — remove navigation to dealbreakers screen at end of quiz

### 2\. Direct quiz launch from home screen (skip intermediate screen)

Currently the home screen quiz button navigates to the issues selection screen first. Change this so tapping "Take the Quiz" / "Change the Quiz" on the home screen opens the policy choices popup directly.

In `src/components/home/VoterHome.tsx`:

```ts
// Instead of routing to the issues selection screen:
// router.push('/settings/issues')

// Route directly to the questionnaire:
router.push('/(auth)/onboarding/questionnaire')
```

If the user has no selected issues yet, the questionnaire screen should handle this gracefully — either show all available issues or prompt inline.

### 3\. Add deselect capability to questionnaire

In `app/(auth)/onboarding/questionnaire.tsx`, modify the answer handler so that tapping an already-selected option deselects it:

```ts
const handleAnswer = (questionId: string, answer: any) => {
  const existing = responses.get(questionId);

  // If the same answer is selected again, deselect it (remove the response)
  if (existing && existing.answer === answer) {
    const updated = new Map(responses);
    updated.delete(questionId);
    setResponses(updated);
    // Auto-save the removal
    updateQuestionnaireResponses(userId, Array.from(updated.values()));
    return;
  }

  // Otherwise, set/update the response as normal
  const updated = new Map(responses);
  updated.set(questionId, { questionId, issueId, answer, answeredAt: new Date() });
  setResponses(updated);
  // Auto-save (existing behavior)
  updateQuestionnaireResponses(userId, Array.from(updated.values()));
};
```

### 4\. Organize policy sections by scope (Global, National, Local)

On the home screen quiz modal, group the policy sections into three categories. This requires either:
- Adding a `scope` field to the Issue type (`'global' | 'national' | 'local'`)
- Or mapping existing issue categories to scope groupings

In the quiz popup, render sections with headers:

```
{/* Global Issues */}
<Text variant="titleSmall" style={styles.scopeHeader}>Global</Text>
{globalIssues.map(issue => <IssueCard key={issue.id} ... />)}

{/* National Issues */}
<Text variant="titleSmall" style={styles.scopeHeader}>National</Text>
{nationalIssues.map(issue => <IssueCard key={issue.id} ... />)}

{/* Local Issues */}
<Text variant="titleSmall" style={styles.scopeHeader}>Local</Text>
{localIssues.map(issue => <IssueCard key={issue.id} ... />)}
```

**Scope mapping** (to be confirmed with content team):
- **Global:** Climate/Environment, Immigration, Foreign Policy
- **National:** Economy, Healthcare, Education, Gun Policy, Civil Rights
- **Local:** Infrastructure, Housing, Public Safety, Zoning

Add `scope: 'global' | 'national' | 'local'` to the Issue type in `src/types/index.ts` and populate in Firestore seed data.

### 5\. Update VoterHome quiz label

```ts
const hasCompletedQuiz = userProfile?.questionnaireResponses?.length > 0;

// In render:
<Text variant="titleMedium">
  {hasCompletedQuiz ? 'Change the Quiz' : 'Take the Quiz'}
</Text>
```

## Testing

- Tapping quiz modal on home screen goes directly to policy choices (no intermediate screen)
- Auto-save works: selecting an option immediately persists the response
- Deselecting a previously chosen option clears it and saves the removal
- Policy sections are grouped under Global, National, and Local headers
- All dealbreaker references are removed: no dealbreaker screen in onboarding, no dealbreaker settings, no dealbreaker filter on For You, no dealbreaker badge on candidate cards, no dealbreaker warning in alignment explainer
- Alignment scores no longer factor in dealbreakers
- Homepage label toggles between "Take the Quiz" / "Change the Quiz"
