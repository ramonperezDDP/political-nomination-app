# PLAN-10D: Inline Quiz Bottom Sheet on Home Screen

> **Status: ✅ APPROVED — ready to implement.** Reviewer feedback incorporated (`docs/feedback/Quiz Updates feedback 4.md`). All 10 UX tweaks addressed.
>
> **Depends on:** PLAN-10C (complete) — uses the new multiple-choice question model and `getActiveQuestions` / `updateSingleQuizResponse` functions.
>
> **Origin:** Original PLAN-03 and PLAN-10 both specified that tapping a question circle on the home screen QuizCard should open a bottom sheet popup with that question's options — not navigate to a separate full-screen quiz page. This was deferred during 10C implementation and is now ready to build.

## Summary

Make each question circle on the home screen QuizCard individually tappable. Tapping a question opens a bottom sheet modal with that question's options, allowing the user to answer without leaving the home page. The "Start/Continue the quiz" CTA at the bottom of the card continues to navigate to the full quiz screen for users who want to answer all questions at once.

This converts the quiz from a **destination** into **ambient interaction** — users answer questions casually while browsing, increasing completion rate and matching data quality.

## Current Behavior

1. User sees QuizCard on home screen with 7 question circles (icons + labels)
2. Tapping **anywhere** on the card navigates to `/(main)/quiz` (full-screen quiz page)
3. User answers questions on the separate page, then navigates back

## Proposed Behavior

1. User sees QuizCard on home screen with 7 question circles (icons + labels)
2. Tapping an **individual question circle** opens a bottom sheet with that question's text and radio-button options
3. User selects an answer → **optimistic UI update** (checkmark + progress counter update immediately) → saves to Firestore in background
4. Bottom sheet auto-dismisses after ~450ms so user sees their selection
5. Tapping the **"Start/Continue the quiz" CTA** still navigates to the full quiz screen
6. Tapping an **already-answered circle** reopens the bottom sheet with the current answer pre-selected, allowing re-answering
7. Dismissing without selecting (tap outside / swipe down) → no save, no change

## Files to Modify

### 1. `src/components/home/QuizCard.tsx`

**Current:** Single `Pressable` wraps entire card → `onPress` navigates to quiz screen.

**Change to:**
- Each question circle becomes an individual `Pressable` that calls `onQuestionPress(questionId)`
- Remove the outer `Pressable` wrapper (card itself is no longer one big tap target)
- The CTA row ("Start/Continue the quiz") keeps its own `Pressable` → navigates to full quiz screen
- Add new prop: `onQuestionPress: (questionId: string) => void`
- Accessibility: add `accessibilityLabel` per circle (e.g., "Trade — answered", "Borders — not answered")
- Larger tap targets for circles (increase hit area to 48x48 minimum)

### 2. `src/components/home/VoterHome.tsx`

**Current:** Passes `onPress={() => router.push('/(main)/quiz')}` to QuizCard.

**Change to:**
- Add state: `activeQuestionId: string | null` for bottom sheet visibility
- Add state: `questions: Question[]` loaded via `getActiveQuestions(selectedDistrict)`
- Pass `onQuestionPress={(id) => setActiveQuestionId(id)}` to QuizCard
- Render `QuizBottomSheet` component when `activeQuestionId` is set
- **Optimistic UI:** Update local `user.questionnaireResponses` state immediately on answer, then persist to Firestore
- **District-change safety:** If `selectedDistrict` changes while bottom sheet is open, force dismiss (clear `activeQuestionId`)
- **First-time hint:** On first quiz interaction, show a subtle text hint below the QuizCard: "Tap a topic to answer quickly" (shown once, then hidden via local state or AsyncStorage)

### 3. New component: `src/components/home/QuizBottomSheet.tsx`

A bottom sheet that shows a single quiz question with radio-button options.

**Props:**
```ts
interface QuizBottomSheetProps {
  visible: boolean;
  question: Question | null;
  currentAnswer?: number;          // spectrum value of existing answer
  onAnswer: (spectrumValue: number) => void;
  onDismiss: () => void;
  saving: boolean;
  autoDismissOnAnswer?: boolean;   // default true — future-proofing for "edit multiple" mode
}
```

**Layout:**
```
─────────────────────────────
  [Question text]

  (●) Short Label — description
  ( ) Short Label — description
  ( ) Short Label — description
─────────────────────────────
```

**Behavior:**
- **Multi-tap guard:** Disable all options after first tap until save completes (`if (saving) return;`)
- **Optimistic selection:** Highlight selected option immediately on tap, before Firestore round-trip
- Calls `onAnswer` with the spectrum value
- Auto-dismisses after ~450ms delay (configurable via `autoDismissOnAnswer` prop)
- If user has already answered, the current answer is pre-selected
- Dismiss by tapping outside or swiping down → no save, no change
- **Error handling:** If save fails, keep sheet open with inline error message: "Failed to save. Try again."

**Implementation notes:**
- Use React Native's `Modal` with `animationType="slide"` and `transparent={true}`
- Do NOT use react-native-paper's `Portal`-based components — they cause touch-blocking issues (documented in TROUBLESHOOTING.md)
- Render conditionally: `{activeQuestionId && <QuizBottomSheet ... />}` to avoid portal touch issues

### 4. `app/(main)/(home)/index.tsx`

No changes needed — VoterHome handles the state internally.

## Data Flow

```
QuizCard circle tap
  → VoterHome.setActiveQuestionId(id)
  → QuizBottomSheet opens with question data
  → User taps option
  → Multi-tap guard activates (saving=true)
  → Optimistic: local state updated immediately (checkmark + progress)
  → Background: updateSingleQuizResponse() writes to Firestore
  → ~450ms delay → bottom sheet auto-dismisses
  → If error: sheet stays open with error message
```

Questions are loaded once in VoterHome via `getActiveQuestions(selectedDistrict)` and cached in state. The same question data is passed to both QuizCard (for icons/labels) and QuizBottomSheet (for full question text + options).

## What Does NOT Change

- The full quiz screen (`app/(main)/quiz.tsx`) remains as-is — still accessible via the CTA and from other entry points (QuizPromptCard on For You, etc.)
- The `updateSingleQuizResponse` Firestore function is reused unchanged
- The Question data model is unchanged
- Alignment scoring is unaffected

## Testing

- [ ] Tapping a question circle opens bottom sheet with correct question and options
- [ ] Selecting an option saves immediately and circle updates to checkmark
- [ ] Progress counter ("3/7 completed") updates optimistically (no Firestore lag)
- [ ] Tapping an already-answered circle shows pre-selected answer
- [ ] Re-answering updates the answer and shows new checkmark
- [ ] Bottom sheet dismisses on outside tap or swipe down without saving
- [ ] "Continue the quiz" CTA still navigates to full quiz screen
- [ ] Bottom sheet does NOT block touches on the home screen after dismissal (no Portal leak)
- [ ] Works correctly when switching districts (PA-01 vs PA-02 local questions change)
- [ ] District change while sheet is open → sheet force-dismisses
- [ ] Rapid multi-tap on options only saves once (no race conditions)
- [ ] Save failure → sheet stays open with error message
- [ ] First-time hint "Tap a topic to answer quickly" appears once
- [ ] Accessibility labels on circles ("Trade — answered", "Borders — not answered")
- [ ] Auto-dismiss delay feels natural (~450ms, not jarring)
