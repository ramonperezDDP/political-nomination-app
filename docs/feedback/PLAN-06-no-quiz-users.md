# Plan 06: No-Quiz User Handling

**Feedback:** Users who haven't filled out the quiz default to "Random" on the For You page. Before scrolling, they see a full-screen message telling them to take the quiz. This message appears every time they open the page until the quiz is completed.

---

## Current State

### For You Page (`app/(tabs)/for-you.tsx`)
- No quiz completion check exists
- All users see the same feed regardless of quiz status
- No prompt to take the quiz

### Onboarding Gate (`app/(auth)/_layout.tsx`)
- Currently BLOCKS access to the main app until quiz is completed
- After Plan 01, this gate is removed — users can access For You without having taken the quiz

### Quiz Completion Check (`src/stores/userStore.ts`)
```typescript
selectHasCompletedOnboarding: (state) =>
  (state.userProfile?.selectedIssues?.length || 0) >= 4 &&
  (state.userProfile?.questionnaireResponses?.length || 0) > 0,
```

After Plan 01, this is replaced by `selectQuestionnaireComplete` / `selectCanSeeAlignment`, which checks `onboarding.questionnaire === 'complete'`. Questionnaire is marked complete when the user answers a minimum of 3 questions (1 global, 1 national, 1 local) per Plan 03's `checkQuizMinimum()`.

---

## Proposed Design

This plan uses Plan 01's capability selectors to determine quiz status. The key selector is `selectCanSeeAlignment` (which checks `onboarding.questionnaire === 'complete'`). The questionnaire is marked complete when the user answers a minimum of 3 questions (1 global, 1 national, 1 local) per Plan 03. Filter gating is handled by the ExperienceMenu component per Plan 05.

### Behavior Flow

```
User opens For You tab
        │
        ├── selectCanSeeAlignment?  (questionnaire = complete, i.e. 3+ answers: 1G + 1N + 1L)
        │       │
        │       ├── YES → Default to "Issues" filter, show normal feed
        │       │
        │       └── NO  → Default to "Random" filter
        │                  Show quiz prompt as FIRST item in feed
        │                  "Issues" disabled (Plan 05: selectCanSeeAlignment)
        │                  "Most Important" disabled (Plan 05: selectCanSeeAlignment + selectCanSeeDealbreakers)
        │                  Prompt shown every visit until quiz minimum met
        │
```

### Quiz Prompt Card

A full-screen card (same size as a PSA) shown as the first item in the feed. Uses the AMSP branding. Not dismissible — user must scroll past it to see PSAs.

```
┌─────────────────────────────────────────────┐
│                                             │
│                                             │
│              [AMSP Logo]                    │
│                                             │
│        Unlock Personalized Results          │
│                                             │
│    Take the policy quiz to see candidates   │
│    that match your views.                   │
│                                             │
│         ┌─────────────────────┐             │
│         │   Take the Quiz →   │             │
│         └─────────────────────┘             │
│                                             │
│         or scroll to browse randomly        │
│                                             │
│                    ↓                        │
│                                             │
└─────────────────────────────────────────────┘
```

---

## New Component: `src/components/feed/QuizPromptCard.tsx`

```tsx
import React from 'react';
import { View, Image, StyleSheet, Dimensions } from 'react-native';
import { Text, Button, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface QuizPromptCardProps {
  height: number;
}

export default function QuizPromptCard({ height }: QuizPromptCardProps) {
  const theme = useTheme();
  const router = useRouter();

  return (
    <View style={[styles.container, { height }]}>
      {/* Background gradient — AMSP purple */}
      <View style={[styles.background, { backgroundColor: theme.colors.primary }]} />

      <View style={styles.content}>
        {/* Logo */}
        <Image
          source={require('../../../assets/amsp-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        {/* Icon */}
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons
            name="clipboard-check-outline"
            size={48}
            color={theme.colors.primary}
          />
        </View>

        {/* Heading */}
        <Text variant="headlineSmall" style={styles.heading}>
          Unlock Personalized Results
        </Text>

        {/* Description */}
        <Text variant="bodyLarge" style={styles.description}>
          Take the policy quiz to see candidates that match your views.
          Answer just 3 questions to get started!
        </Text>

        {/* CTA Button */}
        <Button
          mode="contained"
          onPress={() => router.push('/quiz')}
          style={styles.ctaButton}
          contentStyle={styles.ctaButtonContent}
          labelStyle={styles.ctaButtonLabel}
          icon="arrow-right"
          buttonColor="#fff"
          textColor={theme.colors.primary}
        >
          Take the Quiz
        </Button>

        {/* Scroll hint */}
        <Text variant="bodySmall" style={styles.scrollHint}>
          or scroll down to browse randomly
        </Text>

        <MaterialCommunityIcons
          name="chevron-down"
          size={24}
          color="rgba(255,255,255,0.6)"
          style={styles.chevron}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    position: 'relative',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.95,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  logo: {
    width: 160,
    height: 44,
    tintColor: '#fff',
    marginBottom: 32,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  heading: {
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  ctaButton: {
    borderRadius: 24,
    marginBottom: 24,
  },
  ctaButtonContent: {
    height: 48,
    paddingHorizontal: 24,
    flexDirection: 'row-reverse', // Icon on right
  },
  ctaButtonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  scrollHint: {
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
  },
  chevron: {
    marginTop: 8,
  },
});
```

---

## Integration in `app/(tabs)/for-you.tsx`

### Step 1: Check quiz status using Plan 01 selectors

```typescript
import { useUserStore, selectCanSeeAlignment } from '@/stores';

// Inside ForYouScreen component:
// selectCanSeeAlignment checks onboarding.questionnaire === 'complete'
// which is set when user answers minimum 3 questions (1G + 1N + 1L) per Plan 03
const canSeeAlignment = useUserStore(selectCanSeeAlignment);
```

### Step 2: Default filter based on quiz status

```typescript
const [experienceFilter, setExperienceFilter] = useState<ExperienceFilter>(
  canSeeAlignment ? 'issues' : 'random'
);

// Auto-switch to 'issues' when user completes quiz minimum while app is open:
useEffect(() => {
  if (canSeeAlignment && experienceFilter === 'random') {
    setExperienceFilter('issues');
  }
}, [canSeeAlignment]);
```

### Step 3: Prepend prompt card to feed

```typescript
const displayItems = useMemo(() => {
  if (!canSeeAlignment) {
    // Insert quiz prompt as the first item
    return [
      { id: 'quiz-prompt', type: 'prompt' as const },
      ...filteredItems,
    ];
  }
  return filteredItems;
}, [filteredItems, canSeeAlignment]);
```

### Step 4: Render prompt card in paging FlatList (Plan 04)

The QuizPromptCard uses the same `itemHeight` as Plan 04's `FullScreenPSA`, so it snaps correctly in the paging FlatList:

```typescript
renderItem={({ item, index }) => {
  if (item.type === 'prompt') {
    return <QuizPromptCard height={itemHeight} />;
  }
  return (
    <FullScreenPSA
      feedItem={item}
      isActive={index === activeIndex}
      height={itemHeight}
    />
  );
}}
```

### Step 5: Filter gating handled by ExperienceMenu (Plan 05)

The ExperienceMenu component reads Plan 01's capability selectors directly from the store — no props needed. Gating logic:

```typescript
// Already handled in ExperienceMenu via Plan 01 selectors:
// - Issues: disabled when !selectCanSeeAlignment (questionnaire incomplete)
// - Most Important: disabled when !selectCanSeeAlignment OR !selectCanSeeDealbreakers
// - Location: always available
// - Random: always available
```

Locked filters show a lock icon with an explanation (e.g., "Complete the quiz to unlock").

---

## Persistence: Show Prompt Every Visit

The prompt appears every time the user opens the For You tab, not just once. This is the default behavior since it's based on `selectCanSeeAlignment` — a live check against the user's `onboarding.questionnaire` state in Firestore. No "dismissed" flag is needed.

**Once the quiz minimum is met** (3+ answers: 1 global, 1 national, 1 local per Plan 03):
- `onboarding.questionnaire` flips to `'complete'` (set by Plan 03's auto-save via `checkQuizMinimum()`)
- `selectCanSeeAlignment` returns `true`
- The prompt card is removed from the feed
- The default filter auto-switches to "Issues"
- "Issues" becomes enabled in the ExperienceMenu
- "Most Important" becomes enabled once dealbreakers are also set (`selectCanSeeDealbreakers`)

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/feed/QuizPromptCard.tsx` | Full-screen quiz CTA card |

## Files to Modify

| File | Change |
|------|--------|
| `app/(tabs)/for-you.tsx` | Use `selectCanSeeAlignment` for quiz check, prepend prompt card, default to Random |
| `src/components/feed/index.ts` | Export QuizPromptCard |

---

## Interaction with Other Plans

| Plan | Dependency |
|------|-----------|
| Plan 01 (Registration) | Provides `selectCanSeeAlignment` and `selectCanSeeDealbreakers` selectors for quiz/filter gating. Removes onboarding gate so users CAN reach For You without quiz. Email verification is the only gate to browsing. |
| Plan 03 (Quiz Page) | "Take the Quiz" button routes to `/quiz`. Quiz auto-saves each answer; `checkQuizMinimum()` sets `onboarding.questionnaire = 'complete'` after 3 answers (1G + 1N + 1L). |
| Plan 04 (For You Rework) | QuizPromptCard uses the same `itemHeight` as FullScreenPSA in the paging FlatList. |
| Plan 05 (Experience Filters) | ExperienceMenu reads selectors directly — Issues requires `selectCanSeeAlignment`, Most Important requires both `selectCanSeeAlignment` + `selectCanSeeDealbreakers`. Random and Location always available. |

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| User with 0 quiz responses | Prompt shown, Random default, Issues/Most Important locked |
| User with 1-2 answers (minimum NOT met) | Prompt still shown — minimum is 1 global + 1 national + 1 local (3 total). Quiz auto-saved progress means they can resume. |
| User with 3+ answers meeting minimum (1G + 1N + 1L) | `onboarding.questionnaire = 'complete'` → prompt removed, Issues filter unlocked, auto-switch to Issues. Plan 03 shows "Answer more to improve your matches" banner on quiz screen. |
| User with all 7 answered | Best matching quality. No additional UI change beyond the 3-question threshold. |
| User completes quiz while on For You tab | Real-time Firestore subscription updates user profile → `selectCanSeeAlignment` flips → prompt disappears, filter auto-switches to Issues |
| User navigates away from For You and returns | Prompt reappears if quiz minimum still not met |
| User has quiz done but no dealbreakers set | Issues filter available. Most Important still locked ("Set your dealbreakers to unlock"). |
