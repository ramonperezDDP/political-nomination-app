# Plan 06: No-Quiz User Handling

**Feedback:** Users who haven't filled out the quiz default to "Random" on the For You page. Before scrolling, they see a full-screen message telling them to take the quiz. This message appears every time they open the page until the quiz minimum is met (1 question). The prompt reads: "You've completed X out of 7 quiz questions. Complete more to further refine your search."

---

## Current State (Post-Plan 04)

### What Already Exists

**Most of Plan 06's integration logic is already implemented in Plan 04.**

**`src/components/feed/QuizPromptCard.tsx`** — **Stub** created in Plan 04. Shows a full-screen card with clipboard icon, "Discover Your Matches" title, and "Take Quiz" button. Dark background (`#1a1a2e`). **Missing from spec:** dynamic progress count, AMSP logo/branding, "Continue Quiz" label, scroll hint, chevron-down.

**`app/(tabs)/for-you.tsx`** — Already has all Plan 06 integration:
- `canSeeAlignment` selector imported and used (line 98)
- `experienceFilter` defaults to `canSeeAlignment ? 'issues' : 'random'` (line 103-105)
- Auto-switch from `'random'` to `'issues'` when quiz completed via `useEffect` (lines 108-112)
- `displayItems` prepends `{ id: 'quiz-prompt', type: 'prompt' }` when `!canSeeAlignment` (lines 161-169)
- `renderItem` renders `QuizPromptCard` for prompt type items (lines 198-199)
- QuizPromptCard uses same `itemHeight` as FullScreenPSA for paging snap

**`src/components/feed/index.ts`** — Already exports QuizPromptCard (line 6).

**`src/stores/userStore.ts`** — `selectCanSeeAlignment` checks `onboarding.questionnaire === 'complete'` on the Firestore document. Works uniformly for anonymous and upgraded users since all have a Firestore doc via Firebase Anonymous Auth (Plan 01).

### What Does NOT Exist Yet

The only remaining work is upgrading the **QuizPromptCard stub** to match the full spec:

| Feature | Current Stub | Plan 06 Spec |
| :---- | :---- | :---- |
| Background | Dark `#1a1a2e` | AMSP purple (`theme.colors.primary`) |
| Logo | None | AMSP logo (`assets/amsp-logo.png` — exists) |
| Icon | Clipboard outline, 64px, dim | White circle (80px) with clipboard icon in purple |
| Title | "Discover Your Matches" | "Unlock Personalized Results" |
| Progress text | Static subtitle | Dynamic: "You've completed X out of 7 quiz questions. Complete more to further refine your search." |
| Button label | Always "Take Quiz" | Dynamic: "Take the Quiz" (0 answered) / "Continue Quiz" (1+ answered) |
| Scroll hint | None | "or scroll down to browse randomly" + chevron-down |
| User data | Not read | Reads `userProfile.questionnaireResponses.length` from userStore |

---

## Proposed Design

### Behavior Flow

```
User opens For You tab
        │
        ├── selectCanSeeAlignment?  (1+ quiz question answered)
        │       │
        │       ├── YES → Default to "Issues" filter, show normal feed
        │       │         (Already implemented in for-you.tsx)
        │       │
        │       └── NO  → Default to "Random" filter
        │                  Show quiz prompt as FIRST item in feed
        │                  (Already implemented in for-you.tsx)
        │                  "Issues" locked in ExperienceMenu (Plan 05)
        │                  "Most Important" locked in ExperienceMenu (Plan 05)
        │                  Prompt shown every visit until 1+ question answered
```

### Quiz Prompt Card (Full Spec)

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

## Step 1: Upgrade QuizPromptCard Stub

**File:** `src/components/feed/QuizPromptCard.tsx` — **Replace stub** with full implementation

Key changes from current stub:
- Add `useUserStore` to read `userProfile.questionnaireResponses.length` for progress count
- AMSP purple background via `useTheme().colors.primary`
- AMSP logo image (asset exists at `assets/amsp-logo.png`)
- White icon circle with purple clipboard icon
- Dynamic progress text: "You've completed X out of 7 quiz questions"
- Dynamic button label: "Take the Quiz" vs "Continue Quiz"
- Scroll hint text + chevron-down icon

```tsx
import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { Text, Button, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useUserStore } from '@/stores';

interface QuizPromptCardProps {
  height: number;
}

export default function QuizPromptCard({ height }: QuizPromptCardProps) {
  const theme = useTheme();
  const router = useRouter();
  // All users (anonymous + upgraded) have a Firestore doc via Firebase Anonymous Auth
  const user = useUserStore((s) => s.userProfile);
  const completedCount = user?.questionnaireResponses?.length || 0;

  return (
    <View style={[styles.container, { height }]}>
      <View style={[styles.background, { backgroundColor: theme.colors.primary }]} />

      <View style={styles.content}>
        {/* AMSP Logo */}
        <Image
          source={require('../../../assets/amsp-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        {/* Icon circle */}
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

        {/* Dynamic progress */}
        <Text variant="bodyLarge" style={styles.description}>
          You've completed {completedCount} out of 7 quiz questions.
          Complete more to further refine your search.
        </Text>

        {/* CTA */}
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
    flexDirection: 'row-reverse',
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

**Note:** The spec previously used `Dimensions.get('window').width` for the container width. This is unnecessary — the container gets its width from the parent FlatList which is already full-screen. The `height` prop from `for-you.tsx` handles the vertical dimension.

---

## Integration in `app/(tabs)/for-you.tsx` — ALREADY DONE

All for-you.tsx integration from this plan was implemented in Plan 04. No changes needed:

- **Step 1 (quiz status check):** `canSeeAlignment` already imported and used (line 98)
- **Step 2 (default filter):** `experienceFilter` already defaults based on quiz status (lines 103-105), auto-switches on completion (lines 108-112)
- **Step 3 (prepend prompt):** `displayItems` already prepends quiz prompt when `!canSeeAlignment` (lines 161-169)
- **Step 4 (render in FlatList):** `renderItem` already handles prompt type (lines 198-199)
- **Step 5 (filter gating):** Handled by ExperienceMenu (Plan 05)

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

## Files Summary

### Files to Create

None — QuizPromptCard already exists as a stub.

### Files to Modify

| File | Change |
| :---- | :---- |
| `src/components/feed/QuizPromptCard.tsx` | **Replace stub** with full implementation (AMSP branding, dynamic progress, scroll hint) |

### Files Unchanged (Already Done in Plan 04)

| File | Status |
| :---- | :---- |
| `app/(tabs)/for-you.tsx` | All integration logic already implemented (quiz check, default filter, auto-switch, prepended prompt, renderItem) |
| `src/components/feed/index.ts` | QuizPromptCard already exported |

---

## Implementation Order

1. Replace `QuizPromptCard.tsx` stub with full spec implementation
2. Verify: `npx tsc --noEmit`
3. Build and test:
   - Fresh anonymous user → sees quiz prompt as first card with "0 out of 7" and "Take the Quiz"
   - Answer 1 quiz question → prompt disappears, filter switches to Issues
   - User with some answers but incomplete → sees "X out of 7" and "Continue Quiz"

---

## Interaction with Other Plans

| Plan | Dependency |
| :---- | :---- |
| Plan 01 (Registration) | Provides `selectCanSeeAlignment` and `selectCanSeeDealbreakers` selectors. Firebase Anonymous Auth gives all users a Firestore document from first launch. Removes onboarding gate so all users can reach For You. |
| Plan 03 (Quiz Page) | "Take the Quiz" / "Continue Quiz" routes to `/quiz`. Quiz auto-saves each answer to Firestore (all users have a doc via Anonymous Auth). `checkQuizMinimum()` marks quiz complete after 1 question. |
| Plan 04 (For You Rework) | QuizPromptCard stub created. All for-you.tsx integration already done: quiz check, default filter, auto-switch, prompt prepending, renderItem handling. |
| Plan 05 (Experience Filters) | ExperienceMenu reads selectors directly — Issues requires `selectCanSeeAlignment`, Most Important requires both `selectCanSeeAlignment` + `selectCanSeeDealbreakers`. Random and Location always available (anonymous OK). |

---

## Edge Cases

| Scenario | Behavior |
| :---- | :---- |
| Anonymous user with 0 quiz responses | Prompt shown with "0 out of 7", "Take the Quiz" button, Random default, Issues/Most Important locked |
| Anonymous user with 1+ quiz response | `onboarding.questionnaire = 'complete'` in Firestore → `selectCanSeeAlignment` true → prompt removed, Issues unlocked, auto-switch to Issues. Most Important locked until dealbreakers set. |
| Upgraded user with 0 quiz responses | Same as anonymous — prompt shown, Random default |
| Upgraded user with 1+ quiz response | Prompt removed, Issues unlocked, auto-switch to Issues |
| User with all 7 answered | Best matching quality. No additional UI change beyond the 1-question threshold. |
| User completes quiz while on For You tab | Real-time Firestore listener → `selectCanSeeAlignment` flips → prompt disappears, filter auto-switches to Issues |
| User navigates away from For You and returns | Prompt reappears if quiz minimum still not met |
| User has quiz done but no dealbreakers set | Issues filter available. Most Important still locked ("Set your dealbreakers to unlock"). Dealbreakers available to all users including anonymous. |
| AMSP logo asset missing | Shouldn't happen — `assets/amsp-logo.png` exists in the codebase. If missing, the Image component renders empty but doesn't crash. |
