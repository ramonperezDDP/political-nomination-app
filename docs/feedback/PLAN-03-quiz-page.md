# Plan 03: Quiz Page Redesign

**Feedback:** Remove Description and Search Issues. Break into 3 sections (2 global, 3 national, 2 local). Fit all 7 questions on one screen with no answers showing. Show contestant filter count in top bar. Graphically reflect completed questions.

---

## Current State

### Issues Selection (`app/(auth)/onboarding/issues.tsx`)
- Displays ALL 22 issues grouped by category (Economy, Healthcare, etc.)
- Search bar filters by name/description
- User selects 4-7 issues
- Collapsible category sections with icons and descriptions

### Questionnaire (`app/(auth)/onboarding/questionnaire.tsx`)
- One question at a time (carousel)
- Progress bar: "Question X of Y"
- Supports single_choice and slider types
- Previous/Next navigation

### Current Issue Categories (22 issues across 9 categories)
```
Economy: economy, taxes, minimum-wage
Healthcare: healthcare, medicare, prescription-drugs
Education: education, higher-education
Environment: climate-change, clean-energy
Immigration: immigration, path-to-citizenship
Civil Rights: civil-rights, voting-rights, criminal-justice
Foreign Policy: foreign-policy, defense
Social Issues: gun-policy, abortion, lgbtq-rights
Infrastructure: infrastructure, housing
```

---

## Proposed Design

The quiz is now a **single screen** showing exactly 7 issues in 3 sections. No issue selection step — the 7 issues are predefined per district before the nominating contest begins. Each issue is a compact tappable card that opens its question in a bottom sheet.

**Minimum completion:** 3 questions — at least 1 global, 1 national, and 1 local (aligned with Plan 01's `checkQuizMinimum()`). All 7 are encouraged but not required.

**Auto-save:** Each answer is saved to Firestore immediately. Users can leave and resume later with their progress intact.

**Re-answering:** Tapping a completed issue reopens the modal with the current answer pre-selected. Saving an updated answer triggers a recalculation of candidate matching scores. Users can also change their dealbreaker list (via Settings), which similarly recalculates scores.

### New Layout

```
┌─────────────────────────────────────────────┐
│ Policy Quiz                    0/100 ▼      │
│                              (contestants)   │
├─────────────────────────────────────────────┤
│                                             │
│ GLOBAL ISSUES                               │
│ ┌──────────┐  ┌──────────┐                  │
│ │ 🌍       │  │ 💰       │                  │
│ │ Climate  │  │ Economy  │                  │
│ │  [ ]     │  │  [ ]     │                  │
│ └──────────┘  └──────────┘                  │
│                                             │
│ NATIONAL ISSUES                             │
│ ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│ │ 🏥       │  │ 🎓       │  │ 🔫       │   │
│ │ Health   │  │ Education│  │ Guns     │   │
│ │  [ ]     │  │  [ ]     │  │  [ ]     │   │
│ └──────────┘  └──────────┘  └──────────┘   │
│                                             │
│ LOCAL ISSUES                                │
│ ┌──────────┐  ┌──────────┐                  │
│ │ 🏗️       │  │ 🏠       │                  │
│ │ Infra    │  │ Housing  │                  │
│ │  [ ]     │  │  [ ]     │                  │
│ └──────────┘  └──────────┘                  │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Files to Modify

### 1. New Screen: `app/(tabs)/quiz.tsx` (or refactor existing onboarding)

Since the quiz is now accessible from the Home page (not just onboarding), we need it as a standalone screen. Two options:

**Option A:** Add a new route `app/quiz.tsx` accessible from anywhere
**Option B:** Refactor `app/(auth)/onboarding/issues.tsx` + `questionnaire.tsx` into a unified screen

**Recommended: Option A** — Create `app/quiz.tsx` as a new standalone route, keeping the old onboarding screens intact for backward compatibility.

```tsx
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { Text, useTheme, Banner } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView as NativeSafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useConfigStore, useUserStore } from '@/stores';
import { updateSingleQuizResponse } from '@/services/firebase/firestore';

const SafeAreaView = Platform.OS === 'web' ? View : NativeSafeAreaView;

// Predefined 7 issues per district — configured before the nominating contest begins.
// In production, fetch from Firestore `districts` collection.
const DISTRICT_ISSUES: Record<string, { global: string[]; national: string[]; local: string[] }> = {
  'PA-01': {
    global: ['climate-change', 'economy'],
    national: ['healthcare', 'education', 'gun-policy'],
    local: ['infrastructure', 'housing'],
  },
  'PA-02': {
    global: ['climate-change', 'economy'],
    national: ['healthcare', 'immigration', 'criminal-justice'],
    local: ['infrastructure', 'housing'],
  },
};

export default function QuizScreen() {
  const theme = useTheme();
  const router = useRouter();
  const issues = useConfigStore((s) => s.issues);
  const questions = useConfigStore((s) => s.questions);
  const user = useUserStore((s) => s.userProfile);
  const selectedDistrict = user?.district || 'PA-01';

  const [activeQuestion, setActiveQuestion] = useState<string | null>(null);
  const [responses, setResponses] = useState<Map<string, string | number>>(
    new Map()
  );

  const districtIssues = DISTRICT_ISSUES[selectedDistrict] || DISTRICT_ISSUES['PA-01'];

  // --- Resume: Load existing responses from user profile on mount ---
  useEffect(() => {
    if (user?.questionnaireResponses?.length) {
      const existingResponses = new Map<string, string | number>();
      for (const r of user.questionnaireResponses) {
        existingResponses.set(r.issueId, r.answer);
      }
      setResponses(existingResponses);
    }
  }, []); // Only on mount — don't overwrite local state on re-renders

  // Resolve issue IDs to full Issue objects
  const resolveIssues = (ids: string[]) =>
    ids.map((id) => issues.find((i) => i.id === id)).filter(Boolean);

  const globalIssues = resolveIssues(districtIssues.global);
  const nationalIssues = resolveIssues(districtIssues.national);
  const localIssues = resolveIssues(districtIssues.local);

  const completedCount = responses.size;
  const totalContestants = 100; // Fetched from Firestore (approved candidates count)
  const matchingContestants = 0; // Computed based on current responses

  // --- Minimum completion check (aligned with Plan 01) ---
  const meetsMinimum = useMemo(() => {
    const answered = new Set(responses.keys());
    const hasGlobal = districtIssues.global.some((id) => answered.has(id));
    const hasNational = districtIssues.national.some((id) => answered.has(id));
    const hasLocal = districtIssues.local.some((id) => answered.has(id));
    return hasGlobal && hasNational && hasLocal;
  }, [responses, districtIssues]);

  // --- Auto-save: persist each answer to Firestore immediately ---
  const handleAnswer = useCallback(
    async (issueId: string, answer: string | number) => {
      // Update local state
      setResponses((prev) => new Map(prev).set(issueId, answer));
      setActiveQuestion(null);

      // Persist to Firestore immediately
      const question = questions.find((q) => q.issueId === issueId);
      if (question && user?.id) {
        await updateSingleQuizResponse(user.id, {
          questionId: question.id,
          issueId,
          answer,
        });
      }
    },
    [questions, user?.id]
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.onSurface} />
        </Pressable>
        <Text variant="titleLarge" style={styles.title}>Policy Quiz</Text>
        <View style={styles.contestantBadge}>
          <Text variant="labelLarge" style={{ color: theme.colors.primary }}>
            {matchingContestants}/{totalContestants}
          </Text>
        </View>
      </View>

      {/* "Answer more" banner — shown after meeting minimum but before completing all 7 */}
      {meetsMinimum && completedCount < 7 && (
        <Banner
          visible
          icon="lightbulb-outline"
          style={styles.encourageBanner}
        >
          You've unlocked personalized results! Answer more questions to improve your matches.
        </Banner>
      )}

      <ScrollView contentContainerStyle={styles.content}>
        {/* Global Issues */}
        <IssueSection
          title="Global Issues"
          issues={globalIssues}
          responses={responses}
          onIssuePress={setActiveQuestion}
          theme={theme}
        />

        {/* National Issues */}
        <IssueSection
          title="National Issues"
          issues={nationalIssues}
          responses={responses}
          onIssuePress={setActiveQuestion}
          theme={theme}
        />

        {/* Local Issues */}
        <IssueSection
          title="Local Issues"
          issues={localIssues}
          responses={responses}
          onIssuePress={setActiveQuestion}
          theme={theme}
        />
      </ScrollView>

      {/* Question Bottom Sheet / Modal */}
      <QuestionModal
        issueId={activeQuestion}
        issues={issues}
        existingAnswer={activeQuestion ? responses.get(activeQuestion) : undefined}
        onAnswer={handleAnswer}
        onDismiss={() => setActiveQuestion(null)}
      />
    </SafeAreaView>
  );
}
```

### 2. Issue Section Component

```tsx
interface IssueSectionProps {
  title: string;
  issues: Issue[];
  responses: Map<string, string | number>;
  onIssuePress: (issueId: string) => void;
  theme: any;
}

function IssueSection({ title, issues, responses, onIssuePress, theme }: IssueSectionProps) {
  return (
    <View style={styles.section}>
      <Text variant="titleSmall" style={styles.sectionTitle}>
        {title}
      </Text>
      <View style={styles.issueRow}>
        {issues.map((issue) => {
          const completed = responses.has(issue.id);
          return (
            <Pressable
              key={issue.id}
              onPress={() => onIssuePress(issue.id)}
              style={[
                styles.issueCard,
                completed && {
                  borderColor: theme.colors.primary,
                  backgroundColor: theme.colors.primaryContainer,
                },
              ]}
            >
              <View style={[
                styles.issueIcon,
                completed && { backgroundColor: theme.colors.primary },
              ]}>
                <MaterialCommunityIcons
                  name={completed ? 'check' : issue.icon}
                  size={24}
                  color={completed ? '#fff' : theme.colors.outline}
                />
              </View>
              <Text
                variant="labelMedium"
                numberOfLines={1}
                style={[
                  styles.issueLabel,
                  completed && { color: theme.colors.primary },
                ]}
              >
                {getOneWordLabel(issue.name)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
```

### 3. Question Modal (Bottom Sheet)

When an issue card is tapped, a modal slides up showing the question with answer options. No answers are pre-shown on the main screen.

**Re-answering:** If the user taps a completed issue, the modal opens with their current answer pre-selected. They can change it and save, which triggers an immediate Firestore write and recalculates matching scores.

```tsx
interface QuestionModalProps {
  issueId: string | null;
  issues: Issue[];
  existingAnswer?: string | number; // Pre-select for re-answering
  onAnswer: (issueId: string, answer: string | number) => void;
  onDismiss: () => void;
}

function QuestionModal({ issueId, issues, existingAnswer, onAnswer, onDismiss }: QuestionModalProps) {
  const [selectedValue, setSelectedValue] = useState<string | null>(null);
  const questions = useConfigStore((s) => s.questions);

  // Pre-select existing answer when modal opens (for re-answering)
  useEffect(() => {
    if (existingAnswer !== undefined) {
      setSelectedValue(String(existingAnswer));
    } else {
      setSelectedValue(null);
    }
  }, [issueId, existingAnswer]);

  if (!issueId) return null;

  const question = questions.find((q) => q.issueId === issueId);
  if (!question) return null;

  const hasChanged = existingAnswer !== undefined
    ? selectedValue !== String(existingAnswer)
    : selectedValue !== null;

  return (
    <Portal>
      <Modal
        visible={!!issueId}
        onDismiss={onDismiss}
        contentContainerStyle={styles.modalContent}
      >
        <Text variant="titleMedium" style={styles.questionText}>
          {question.text}
        </Text>
        <RadioButton.Group
          value={selectedValue || ''}
          onValueChange={setSelectedValue}
        >
          {question.options?.map((option) => (
            <Pressable
              key={option.id}
              onPress={() => setSelectedValue(String(option.value))}
              style={[
                styles.optionCard,
                selectedValue === String(option.value) && styles.optionSelected,
              ]}
            >
              <RadioButton value={String(option.value)} />
              <Text variant="bodyMedium" style={styles.optionText}>
                {option.text}
              </Text>
            </Pressable>
          ))}
        </RadioButton.Group>
        <Button
          mode="contained"
          disabled={!selectedValue || !hasChanged}
          onPress={() => onAnswer(issueId, selectedValue!)}
          style={styles.confirmButton}
        >
          {existingAnswer !== undefined ? 'Update Answer' : 'Confirm'}
        </Button>
      </Modal>
    </Portal>
  );
}
```

### 4. Contestant Filter Count (Top Bar)

**Logic:** Show `X/Y` where:
- `Y` = total approved candidates in the user's district
- `X` = candidates matching ANY of the user's current quiz answers

```typescript
// In quiz screen, compute matching count:
const computeMatchingCount = useCallback(
  (responses: Map<string, string | number>, candidates: Candidate[]) => {
    if (responses.size === 0) return 0;

    return candidates.filter((candidate) => {
      // Check if candidate matches ANY answered question
      for (const [issueId, userAnswer] of responses) {
        const candidatePosition = candidate.topIssues.find(
          (ti) => ti.issueId === issueId
        );
        if (!candidatePosition) continue;

        // Match if candidate's spectrum position is on the same side
        const userValue = Number(userAnswer);
        const candidateValue = candidatePosition.spectrumPosition;
        const sameDirection =
          (userValue >= 0 && candidateValue >= 0) ||
          (userValue < 0 && candidateValue < 0);

        if (sameDirection) return true;
      }
      return false;
    }).length;
  },
  []
);
```

For "Must Match" (dealbreaker) issues, candidates with opposing positions are **excluded** entirely:

```typescript
// Must Match filtering: eliminate candidates who don't align on dealbreaker issues
const applyMustMatchFilter = (
  candidates: Candidate[],
  responses: Map<string, string | number>,
  dealbreakers: string[]
) => {
  return candidates.filter((candidate) => {
    for (const dealbreakerId of dealbreakers) {
      const userAnswer = responses.get(dealbreakerId);
      if (userAnswer === undefined) continue;

      const candidatePosition = candidate.topIssues.find(
        (ti) => ti.issueId === dealbreakerId
      );
      if (!candidatePosition) continue;

      const userValue = Number(userAnswer);
      const candidateValue = candidatePosition.spectrumPosition;
      const oppositeDirection =
        (userValue >= 0 && candidateValue < 0) ||
        (userValue < 0 && candidateValue >= 0);

      if (oppositeDirection) return false; // Eliminated
    }
    return true;
  });
};
```

### 5. Graphical Completion Feedback

When a question is answered, the issue card transforms:
- **Unanswered:** Gray border, gray icon, one-word label
- **Answered:** Primary color border, primary background tint, white checkmark icon, label in primary color

Additionally, a subtle animation (scale bounce) plays when completing a question:

```typescript
// In IssueCard, add animated feedback:
const scaleAnim = useRef(new Animated.Value(1)).current;

const onComplete = () => {
  Animated.sequence([
    Animated.spring(scaleAnim, { toValue: 1.1, useNativeDriver: true }),
    Animated.spring(scaleAnim, { toValue: 1.0, useNativeDriver: true }),
  ]).start();
};
```

### 6. Saving Quiz Responses (Auto-Save)

Each answer is saved to Firestore **immediately** after the user confirms it — no batch save needed. This ensures partial completions persist and users can pick up where they left off.

#### New Firestore helper: `updateSingleQuizResponse`

```typescript
// In src/services/firebase/firestore.ts:
export async function updateSingleQuizResponse(
  userId: string,
  response: QuestionnaireResponse
): Promise<void> {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  const existing: QuestionnaireResponse[] =
    userSnap.data()?.questionnaireResponses || [];

  // Replace existing answer for this issue, or append new one
  const updated = existing.filter((r) => r.issueId !== response.issueId);
  updated.push(response);

  await updateDoc(userRef, {
    questionnaireResponses: updated,
    updatedAt: serverTimestamp(),
  });
}
```

This approach:
- **Creates** a new response if the user hasn't answered this issue before
- **Replaces** an existing response if the user re-answers (updates matching scores)
- **Preserves** all other responses untouched

#### Resume on mount

When the quiz screen opens, existing responses are loaded from the user profile into local state:

```typescript
useEffect(() => {
  if (user?.questionnaireResponses?.length) {
    const existingResponses = new Map<string, string | number>();
    for (const r of user.questionnaireResponses) {
      existingResponses.set(r.issueId, r.answer);
    }
    setResponses(existingResponses);
  }
}, []); // Only on mount
```

#### Updating `selectedIssues`

The user's `selectedIssues` are set to the 7 district issues on first quiz answer (if not already set):

```typescript
// Called once, on the user's first quiz answer:
const ensureSelectedIssues = async () => {
  if (user?.selectedIssues?.length) return; // Already set
  const allIssueIds = [
    ...districtIssues.global,
    ...districtIssues.national,
    ...districtIssues.local,
  ];
  await updateSelectedIssues(user.id, allIssueIds);
};
```

#### Dealbreaker changes

Users can also change their dealbreaker list via the existing Settings > Dealbreakers screen (`app/settings/dealbreakers.tsx`). When dealbreakers change, candidate matching scores are recalculated the next time the For You feed loads (Plan 04/05). No additional work needed in the quiz screen itself — the dealbreaker state lives independently on the user document.

---

## Files to Create

| File | Purpose |
|------|---------|
| `app/quiz.tsx` | Standalone quiz screen (accessible from Home + Settings) |
| `src/components/quiz/IssueSection.tsx` | Section component (Global/National/Local) |
| `src/components/quiz/QuestionModal.tsx` | Bottom sheet with question + answer options |
| `src/components/quiz/ContestantCounter.tsx` | Top bar X/Y contestant badge |

## Files to Modify

| File | Change |
|------|--------|
| `src/stores/configStore.ts` | Add `questions` to state, fetch on init |
| `src/services/firebase/firestore.ts` | Add `updateSingleQuizResponse()` for auto-save |
| `src/components/home/VoterHome.tsx` | Quiz card links to `app/quiz.tsx` |
| `app/_layout.tsx` | Add `quiz` route to root stack |

---

## Mapping: 7 Issues to 3 Sections

The feedback specifies 2 global, 3 national, 2 local. The exact mapping per district should be configurable. Default for PA-01:

| Section | Issues | Count |
|---------|--------|-------|
| Global | Climate Change, Economy & Jobs | 2 |
| National | Healthcare, Education, Gun Policy | 3 |
| Local | Infrastructure, Housing | 2 |

This mapping could be stored in Firestore under a `districts` collection for flexibility, or hardcoded for the beta.

---

## Confirmed Decisions

1. **Issues are predefined per district.** The 7 issues are defined before the nominating contest begins. Users do not choose their own issues. Minimum completion is 3 questions (1 global, 1 national, 1 local) — aligned with Plan 01's `checkQuizMinimum()`.

2. **Auto-save after each answer.** Each response is persisted to Firestore immediately via `updateSingleQuizResponse()`. Users can leave the quiz and resume later with all progress intact.

3. **Re-answering is allowed.** Tapping a completed issue reopens the modal with the current answer pre-selected. Saving an updated answer overwrites the previous response in Firestore, which triggers recalculation of candidate matching scores on the next feed load. Users can also change their dealbreaker list via Settings, which similarly affects matching.