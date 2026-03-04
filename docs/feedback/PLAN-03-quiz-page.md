# Plan 03: Quiz Page Redesign

**Status:** Implemented (2026-03-04)

**Feedback:** Remove Description and Search Issues. Break into 3 sections (2 global, 3 national, 2 local). Fit all 7 questions on one screen with no answers showing. Show contestant filter count in top bar. Graphically reflect completed questions. Minimum of 1 question to "complete" the quiz.

## Implementation Summary

### Files Created
- `app/quiz.tsx` — Single-screen quiz with 7 predefined district issues in 3 sections (Global/National/Local), BottomSheet for answering, auto-save via `updateSingleQuizResponse`

### Files Modified
- `src/services/firebase/firestore.ts` — Added `updateSingleQuizResponse()` and `QuestionnaireResponse` import
- `src/services/firebase/firestore.web.ts` — Added `updateSingleQuizResponse()` (web SDK) and `QuestionnaireResponse` import
- `app/_layout.tsx` — Registered `quiz` route in root Stack with header
- `src/utils/alignment.ts` — Enhanced `calculateAlignmentScore` to factor in user quiz answers (spectrum position comparison), not just issue overlap
- `app/(tabs)/for-you.tsx` — Pass `userResponses` to alignment calculation so scores reflect quiz answers
- `app/candidate/[id].tsx` — Pass `userResponses` to alignment calculation for consistent scoring
- `src/components/home/VoterHome.tsx` — Fixed to read user from `useAuthStore` (real-time Firestore subscription) instead of `useUserStore`; count only district-issue responses for QuizCard progress
- `app/quiz.tsx` — Sets `selectedIssues` to district issue IDs on answer so alignment scores activate

### Alignment Score Formula (updated)
The alignment score now combines three factors:
- **Issue overlap** (30 pts): What percentage of the user's 7 district issues does the candidate also prioritize?
- **Spectrum alignment** (40 pts): How close are the user's quiz answer positions to the candidate's positions on the same issues? Compares numeric spectrum values (-100 to 100).
- **Priority bonus** (20 pts): Are matched issues high priority for the candidate?
- **Base** (10 pts): Minimum score for any candidate with issues.

### Deferred to Future
- Contestant filter count in top bar (requires candidate matching computation — Plan 04/05)
- Scale bounce animation on completion
- Separate `IssueSection`, `QuestionModal`, `ContestantCounter` components (inlined in quiz.tsx for simplicity)

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
- Supports single\_choice and slider types
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

**Minimum completion:** 1 question answered marks the quiz as `complete` and unlocks alignment scores + the "Issues" filter (aligned with Plan 01's `checkQuizMinimum()`). All 7 are encouraged but not required.

**Auto-save:** Each answer is saved immediately to Firestore via `updateSingleQuizResponse()`. Since all users — including anonymous users — have a Firestore document (via Firebase Anonymous Auth, Plan 01), there is no dual-storage branching. Quiz data is always written to Firestore under the user's UID.

**Re-answering:** Tapping a completed issue reopens the modal with the current answer pre-selected. Saving an updated answer triggers a recalculation of candidate matching scores. Users can also change their dealbreaker list (via Settings, available to all users including anonymous), which similarly recalculates scores.

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
│ ┌─────────────────────────────────────────┐ │
│ │ You've completed 3 out of 7 quiz        │ │
│ │ questions. Complete more to further     │ │
│ │ refine your search.                     │ │
│ └─────────────────────────────────────────┘ │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Files to Modify

### 1\. New Screen: `app/quiz.tsx`

The quiz is accessible from the Home page, the For You quiz prompt (Plan 06), and Settings — not just onboarding. It is a standalone screen at the root level.

```
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
import { useConfigStore, useUserStore, selectCanSeeAlignment } from '@/stores';
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
  const selectedDistrict = useUserStore((s) => s.selectedBrowsingDistrict) || 'PA-01';

  const [activeQuestion, setActiveQuestion] = useState<string | null>(null);
  const [responses, setResponses] = useState<Map<string, string | number>>(
    new Map()
  );

  const districtIssues = DISTRICT_ISSUES[selectedDistrict] || DISTRICT_ISSUES['PA-01'];

  // --- Resume: Load existing responses from Firestore user profile ---
  useEffect(() => {
    if (user?.questionnaireResponses?.length) {
      const responseMap = new Map<string, string | number>();
      for (const r of user.questionnaireResponses) {
        responseMap.set(r.issueId, r.answer);
      }
      setResponses(responseMap);
    }
  }, []); // Only on mount

  // Resolve issue IDs to full Issue objects
  const resolveIssues = (ids: string[]) =>
    ids.map((id) => issues.find((i) => i.id === id)).filter(Boolean);

  const globalIssues = resolveIssues(districtIssues.global);
  const nationalIssues = resolveIssues(districtIssues.national);
  const localIssues = resolveIssues(districtIssues.local);

  const completedCount = responses.size;
  const totalContestants = 100; // Fetched from Firestore (approved candidates count)
  const matchingContestants = 0; // Computed based on current responses

  // --- Minimum completion check (1 question per Plan 01) ---
  const meetsMinimum = completedCount >= 1;

  // --- Auto-save: persist each answer immediately ---
  const handleAnswer = useCallback(
    async (issueId: string, answer: string | number) => {
      // Update local state
      setResponses((prev) => new Map(prev).set(issueId, answer));
      setActiveQuestion(null);

      // Build response object
      const question = questions.find((q) => q.issueId === issueId);
      const response = {
        questionId: question?.id || issueId,
        issueId,
        answer,
      };

      // All users (anonymous + upgraded) have a Firestore doc — save directly
      if (user?.id) {
        await updateSingleQuizResponse(user.id, response);
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

      {/* Progress banner — shown after meeting minimum but before completing all 7 */}
      {meetsMinimum && completedCount < 7 && (
        <Banner
          visible
          icon="lightbulb-outline"
          style={styles.encourageBanner}
        >
          You've completed {completedCount} out of 7 quiz questions.
          Complete more to further refine your search.
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

### 2\. Issue Section Component

```
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

### 3\. Question Modal (Bottom Sheet)

When an issue card is tapped, a modal slides up showing the question with answer options. No answers are pre-shown on the main screen.

**Re-answering:** If the user taps a completed issue, the modal opens with their current answer pre-selected. They can change it and save, which triggers an immediate Firestore write and recalculates matching scores.

```
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

### 4\. Contestant Filter Count (Top Bar)

**Logic:** Show `X/Y` where:

- `Y` = total approved candidates in the user's browsing district
- `X` = candidates matching ANY of the user's current quiz answers

```ts
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

```ts
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

### 5\. Graphical Completion Feedback

When a question is answered, the issue card transforms:

- **Unanswered:** Gray border, gray icon, one-word label
- **Answered:** Primary color border, primary background tint, white checkmark icon, label in primary color

Additionally, a subtle animation (scale bounce) plays when completing a question:

```ts
// In IssueCard, add animated feedback:
const scaleAnim = useRef(new Animated.Value(1)).current;

const onComplete = () => {
  Animated.sequence([
    Animated.spring(scaleAnim, { toValue: 1.1, useNativeDriver: true }),
    Animated.spring(scaleAnim, { toValue: 1.0, useNativeDriver: true }),
  ]).start();
};
```

### 6\. Saving Quiz Responses (Auto-Save)

Each answer is saved **immediately** after the user confirms it — no batch save needed. This ensures partial completions persist and users can pick up where they left off.

**For all users (anonymous and upgraded):** saved directly to Firestore via `updateSingleQuizResponse()`. Since Firebase Anonymous Auth (Plan 01) gives every user a real UID and Firestore document from first launch, there is no need for local storage or sync logic.

#### Firestore helper: `updateSingleQuizResponse`

```ts
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

  const updateData: any = {
    questionnaireResponses: updated,
    updatedAt: serverTimestamp(),
  };

  // Mark questionnaire complete if minimum met (1 question)
  if (updated.length >= 1) {
    updateData['onboarding.questionnaire'] = 'complete';
  }

  await updateDoc(userRef, updateData);
}
```

This approach:

- **Creates** a new response if the user hasn't answered this issue before
- **Replaces** an existing response if the user re-answers (updates matching scores)
- **Preserves** all other responses untouched
- **Marks quiz complete** when the 1-question minimum is met

#### Resume on mount

When the quiz screen opens, existing responses are loaded from the Firestore user profile (available via the Zustand store's real-time listener). Both anonymous and upgraded users have a Firestore document, so no branching is needed:

```ts
useEffect(() => {
  if (user?.questionnaireResponses?.length) {
    const responseMap = new Map<string, string | number>();
    for (const r of user.questionnaireResponses) {
      responseMap.set(r.issueId, r.answer);
    }
    setResponses(responseMap);
  }
}, []);
```

#### Updating `selectedIssues`

The user's `selectedIssues` are set to the 7 district issues on first quiz answer (if not already set). Works for all users (anonymous and upgraded) since everyone has a Firestore document:

```ts
// Called once, on the user's first quiz answer:
const ensureSelectedIssues = async () => {
  if (!user?.id) return;
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

Users can change their dealbreaker list via the existing Settings > Dealbreakers screen (`app/settings/dealbreakers.tsx`). Dealbreakers are available to all users including anonymous (saved to Firestore under their UID, per Plan 01). When dealbreakers change, candidate matching scores are recalculated the next time the For You feed loads (Plan 04/05). No additional work needed in the quiz screen itself — the dealbreaker state lives independently on the user document. Users can see which specific dealbreakers a candidate triggers (and the candidate's position on each) by tapping the dealbreaker badge on PSACard or the candidate profile page.

---

## Files to Create

| File | Purpose |
| :---- | :---- |
| `app/quiz.tsx` | Standalone quiz screen (accessible from Home + For You + Settings) |
| `src/components/quiz/IssueSection.tsx` | Section component (Global/National/Local) |
| `src/components/quiz/QuestionModal.tsx` | Bottom sheet with question + answer options |
| `src/components/quiz/ContestantCounter.tsx` | Top bar X/Y contestant badge |

## Files to Modify

| File | Change |
| :---- | :---- |
| `src/stores/configStore.ts` | Add `questions` to state, fetch on init |
| `src/services/firebase/firestore.ts` | Add `updateSingleQuizResponse()` for auto-save |
| `src/components/home/QuizCard.tsx` | Already extracted as standalone component; update `onPress` to navigate to `app/quiz.tsx` |
| `app/_layout.tsx` | Add `quiz` route to root stack |

---

## Mapping: 7 Issues to 3 Sections

The feedback specifies 2 global, 3 national, 2 local. The exact mapping per district is configurable. Default for PA-01:

| Section | Issues | Count |
| :---- | :---- | :---- |
| Global | Climate Change, Economy & Jobs | 2 |
| National | Healthcare, Education, Gun Policy | 3 |
| Local | Infrastructure, Housing | 2 |

This mapping is stored in the `DISTRICT_ISSUES` config (hardcoded for beta, Firestore `districts` collection for production).

---

## Confirmed Decisions

1. **Issues are predefined per district.** The 7 issues are defined before the nominating contest begins. Users do not choose their own issues. Minimum completion is 1 question — aligned with Plan 01's `checkQuizMinimum()`.

2. **Auto-save after each answer.** Each response is persisted immediately to Firestore via `updateSingleQuizResponse()`. All users (anonymous and upgraded) have a Firestore document via Firebase Anonymous Auth (Plan 01), so there is no dual-storage branching. Users can leave the quiz and resume later with all progress intact.

3. **Re-answering is allowed.** Tapping a completed issue reopens the modal with the current answer pre-selected. Saving an updated answer overwrites the previous response, which triggers recalculation of candidate matching scores on the next feed load.

4. **Anonymous users can take the quiz.** No email/password account is required. Firebase Anonymous Auth (Plan 01) silently signs users in on first launch and gives them a Firestore document. Quiz data is saved under their anonymous UID. When the user later upgrades to an email/password account via `linkWithCredential`, the UID stays the same and all quiz data remains in place — no sync needed.
