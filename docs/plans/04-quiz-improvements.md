# PLAN: Quiz Improvements

## Summary
- Add a save button at the end of the quiz; only show saved results on the report
- The report should show results from the last saved quiz; the quiz section itself should show a fresh quiz every time
- On the report, move the checkmark so it doesn't block the label
- "Take the Quiz" label toggles to "Change the Quiz" once completed
- Replace progress indicator "0/7 Completed" with icons that light up when answered

## Current State
- Quiz lives in `app/(auth)/onboarding/questionnaire.tsx` (365 lines)
- Questions loaded from Firestore based on selected issues (lines 31-63)
- Responses stored via `useUserStore().updateQuestionnaireResponses()` (line 104)
- Progress shown as `ProgressBar` component (lines 223-227)
- No separate "report" view — responses are saved immediately as user progresses
- No concept of saved vs unsaved quiz state
- Quiz label on homepage is hardcoded "Policy Preferences" in `VoterHome.tsx:28`

## Files to Modify
- `app/(auth)/onboarding/questionnaire.tsx` — add save button, fresh quiz logic
- `src/components/home/VoterHome.tsx` — toggle quiz label, link to quiz report
- `src/stores/userStore.ts` — add saved vs draft quiz state

## Files to Create
- `app/settings/quiz-report.tsx` — new screen showing last saved quiz results
- `src/components/home/QuizProgressIcons.tsx` — icon-based progress indicator

## Implementation Details

### 1. Add draft/saved quiz state to userStore (`src/stores/userStore.ts`)

```typescript
// Add to interface
draftQuizResponses: QuestionnaireResponse[];
setDraftQuizResponses: (responses: QuestionnaireResponse[]) => void;
saveQuizResponses: (userId: string) => Promise<void>;

// Implementation
draftQuizResponses: [],

setDraftQuizResponses: (responses) => {
  set({ draftQuizResponses: responses });
},

saveQuizResponses: async (userId) => {
  const { draftQuizResponses } = get();
  if (draftQuizResponses.length === 0) return;

  await updateQuestionnaireResponses(userId, draftQuizResponses);
  set({
    userProfile: {
      ...get().userProfile!,
      questionnaireResponses: draftQuizResponses,
    },
    draftQuizResponses: [],
  });
},
```

### 2. Modify questionnaire to accumulate draft responses

In `app/(auth)/onboarding/questionnaire.tsx`, change the answer handler to store in draft state instead of saving immediately:

```typescript
// Replace immediate save (line 104) with draft accumulation
const handleAnswer = (questionId: string, answer: any) => {
  const updated = [...draftResponses];
  const existingIndex = updated.findIndex(r => r.questionId === questionId);
  if (existingIndex >= 0) {
    updated[existingIndex] = { questionId, answer, answeredAt: new Date() };
  } else {
    updated.push({ questionId, answer, answeredAt: new Date() });
  }
  setDraftResponses(updated);
};
```

Add save button on the last question:

```tsx
{isLastQuestion && (
  <PrimaryButton
    onPress={async () => {
      await saveQuizResponses(user.id);
      router.back();
    }}
    icon="content-save"
    style={{ marginTop: 16 }}
  >
    Save Results
  </PrimaryButton>
)}
```

### 3. Create icon-based progress component (`src/components/home/QuizProgressIcons.tsx`)

Replace "0/7 Completed" with category icons that light up:

```tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const ISSUE_ICONS = [
  { id: 'economy', icon: 'cash' },
  { id: 'healthcare', icon: 'hospital' },
  { id: 'education', icon: 'school' },
  { id: 'environment', icon: 'leaf' },
  { id: 'security', icon: 'shield' },
  { id: 'immigration', icon: 'earth' },
  { id: 'infrastructure', icon: 'road' },
];

interface Props {
  answeredIds: string[];
}

export default function QuizProgressIcons({ answeredIds }: Props) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      {ISSUE_ICONS.map((item) => {
        const isAnswered = answeredIds.includes(item.id);
        return (
          <MaterialCommunityIcons
            key={item.id}
            name={item.icon as any}
            size={28}
            color={isAnswered ? theme.colors.primary : theme.colors.outlineVariant}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
});
```

### 4. Create quiz report screen (`app/settings/quiz-report.tsx`)

```tsx
// Shows the LAST SAVED quiz results
// Each issue shows the user's saved position with a label (not a checkmark over it)
// Checkmark rendered beside the label, not overlapping it:

<View style={styles.resultRow}>
  <MaterialCommunityIcons name="check-circle" size={20} color={theme.colors.primary} />
  <Text variant="bodyMedium" style={styles.resultLabel}>{issue.name}</Text>
  <Text variant="bodySmall" style={styles.resultValue}>{response.answer}</Text>
</View>
```

### 5. Update VoterHome quiz label

```tsx
const hasCompletedQuiz = userProfile?.questionnaireResponses?.length > 0;

// In render:
<Text variant="titleMedium">
  {hasCompletedQuiz ? 'Change the Quiz' : 'Take the Quiz'}
</Text>
```

## Testing
- Opening quiz always starts fresh (no pre-filled answers)
- Answers accumulate in draft state as user progresses
- Save button appears on last question
- Saved results appear on the report screen
- Checkmarks on report are beside labels, not overlapping
- Icons light up as questions are answered
- Homepage label toggles between "Take the Quiz" / "Change the Quiz"
