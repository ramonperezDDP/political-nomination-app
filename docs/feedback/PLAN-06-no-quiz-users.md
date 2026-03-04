# Plan 06: No-Quiz User Handling

**Feedback:** Users who haven't filled out the quiz default to "Random" on the For You page. Before scrolling, they see a full-screen message telling them to take the quiz. This message appears every time they open the page until the quiz minimum is met (1 question). The prompt reads: "You've completed X out of 7 quiz questions. Complete more to further refine your search."

---

## Current State

### For You Page (`app/(tabs)/for-you.tsx`)

- No quiz completion check exists
- All users see the same feed regardless of quiz status
- No prompt to take the quiz

### Onboarding Gate (`app/(auth)/_layout.tsx`)

- Currently BLOCKS access to the main app until quiz is completed
- After Plan 01, this gate is removed — anonymous users and authenticated users alike can access For You without taking the quiz

### Quiz Completion Check (`src/stores/userStore.ts`)

```ts
selectHasCompletedOnboarding: (state) =>
  (state.userProfile?.selectedIssues?.length || 0) >= 4 &&
  (state.userProfile?.questionnaireResponses?.length || 0) > 0,
```

After Plan 01, this is replaced by `selectCanSeeAlignment`, which checks `onboarding.questionnaire === 'complete'` on the user's Firestore document. This works uniformly for both anonymous and upgraded users since all users have a Firestore document via Firebase Anonymous Auth (Plan 01).

The quiz is marked complete when the user answers a minimum of **1 question** (per Plan 01/03).

---

## Proposed Design

This plan uses Plan 01's capability selectors to determine quiz status. The key selector is `selectCanSeeAlignment`. Filter gating is handled by the ExperienceMenu component per Plan 05.

### Behavior Flow

```
User opens For You tab
        │
        ├── selectCanSeeAlignment?  (1+ quiz question answered)
        │       │
        │       ├── YES → Default to "Issues" filter, show normal feed
        │       │
        │       └── NO  → Default to "Random" filter
        │                  Show quiz prompt as FIRST item in feed
        │                  "Issues" locked in ExperienceMenu (Plan 05)
        │                  "Most Important" locked in ExperienceMenu (Plan 05)
        │                  Prompt shown every visit until 1+ question answered
        │
```

### Quiz Prompt Card

A full-screen card (same height as a PSA in the paging FlatList from Plan 04) shown as the first item in the feed. Uses the AMSP branding. Not dismissible — user must scroll past it to see PSAs.

The prompt dynamically shows the user's progress:

```
┌─────────────────────────────────────────────┐
│                                             │
│                                             │
│              [AMSP Logo]                    │
│                                             │
│        Unlock Personalized Results          │
│                                             │
│    You've completed 0 out of 7 quiz         │
│    questions. Complete more to further      │
│    refine your search.                      │
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

```
import React from 'react';
import { View, Image, StyleSheet, Dimensions } from 'react-native';
import { Text, Button, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useUserStore } from '@/stores';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface QuizPromptCardProps {
  height: number;
}

export default function QuizPromptCard({ height }: QuizPromptCardProps) {
  const theme = useTheme();
  const router = useRouter();
  const user = useUserStore((s) => s.userProfile);

  // All users (anonymous + upgraded) have a Firestore doc via Firebase Anonymous Auth
  const completedCount = user?.questionnaireResponses?.length || 0;

  return (
    <View style={[styles.container, { height }]}>
      {/* Background — AMSP purple */}
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

        {/* Dynamic progress description */}
        <Text variant="bodyLarge" style={styles.description}>
          You've completed {completedCount} out of 7 quiz questions.
          Complete more to further refine your search.
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
          {completedCount === 0 ? 'Take the Quiz' : 'Continue Quiz'}
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

```ts
import { useUserStore, selectCanSeeAlignment } from '@/stores';

// Inside ForYouScreen component:
// selectCanSeeAlignment checks onboarding.questionnaire === 'complete'
// Works uniformly for both anonymous and upgraded users (both have Firestore docs)
const canSeeAlignment = useUserStore(selectCanSeeAlignment);
```

### Step 2: Default filter based on quiz status

```ts
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

```ts
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

```ts
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

```ts
// Already handled in ExperienceMenu via Plan 01 selectors:
// - Issues: disabled when !selectCanSeeAlignment (quiz incomplete)
// - Most Important: disabled when !selectCanSeeAlignment OR !selectCanSeeDealbreakers
// - Location: always available (anonymous OK)
// - Random: always available (anonymous OK)
```

Locked filters show a lock icon with an explanation (e.g., "Complete the quiz to unlock").

---

## Persistence: Show Prompt Every Visit

The prompt appears every time the user opens the For You tab, not just once. This is the default behavior since it's based on `selectCanSeeAlignment` — a live check against the user's quiz state. No "dismissed" flag is needed.

**Once the quiz minimum is met** (1+ question answered per Plan 01/03):

- `onboarding.questionnaire` flips to `'complete'` on the user's Firestore document (via `updateSingleQuizResponse` in Plan 03) — works for both anonymous and upgraded users
- `selectCanSeeAlignment` returns `true`
- The prompt card is removed from the feed
- The default filter auto-switches to "Issues"
- "Issues" becomes enabled in the ExperienceMenu
- "Most Important" becomes enabled once dealbreakers are also set (available to all users including anonymous)

---

## Files to Create

| File | Purpose |
| :---- | :---- |
| `src/components/feed/QuizPromptCard.tsx` | Full-screen quiz CTA card with dynamic progress |

## Files to Modify

| File | Change |
| :---- | :---- |
| `app/(tabs)/for-you.tsx` | Use `selectCanSeeAlignment` for quiz check, prepend prompt card, default to Random |
| `src/components/feed/index.ts` | Export QuizPromptCard |

---

## Interaction with Other Plans

| Plan | Dependency |
| :---- | :---- |
| Plan 01 (Registration) | Provides `selectCanSeeAlignment` and `selectCanSeeDealbreakers` selectors. Provides `selectIsAnonymous` for knowing if user has upgraded. Firebase Anonymous Auth gives all users a Firestore document from first launch. Removes onboarding gate so all users can reach For You. |
| Plan 03 (Quiz Page) | "Take the Quiz" / "Continue Quiz" button routes to `/quiz`. Quiz auto-saves each answer to Firestore (all users have a Firestore doc via Anonymous Auth). `checkQuizMinimum()` marks quiz complete after 1 question. |
| Plan 04 (For You Rework) | QuizPromptCard uses the same `itemHeight` as FullScreenPSA in the paging FlatList. Vertical swipe only. Tab bar visible. |
| Plan 05 (Experience Filters) | ExperienceMenu reads selectors directly — Issues requires `selectCanSeeAlignment`, Most Important requires both `selectCanSeeAlignment` + `selectCanSeeDealbreakers`. Random and Location always available (anonymous OK). |

---

## Edge Cases

| Scenario | Behavior |
| :---- | :---- |
| Anonymous user with 0 quiz responses | Prompt shown, Random default, Issues/Most Important locked |
| Anonymous user with 1+ quiz response | `onboarding.questionnaire = 'complete'` in Firestore → `selectCanSeeAlignment` returns true → prompt removed, Issues unlocked, auto-switch to Issues. Most Important still locked until dealbreakers are set. |
| Upgraded user with 0 quiz responses | Prompt shown, Random default, Issues/Most Important locked |
| Upgraded user with 1+ quiz response | `onboarding.questionnaire = 'complete'` → prompt removed, Issues unlocked, auto-switch to Issues |
| User with all 7 answered | Best matching quality. No additional UI change beyond the 1-question threshold. |
| User completes quiz while on For You tab | Real-time Firestore listener → `selectCanSeeAlignment` flips → prompt disappears, filter auto-switches to Issues |
| User navigates away from For You and returns | Prompt reappears if quiz minimum still not met |
| User has quiz done but no dealbreakers set | Issues filter available. Most Important still locked ("Set your dealbreakers to unlock"). Dealbreakers available to all users including anonymous. |
