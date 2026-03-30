# PLAN-17: Unified App Shell — Header, Tab Persistence, and Navigation

> **Replaces:** PLAN-07 (title bar), PLAN-08 (footer persistence), PLAN-15 (back button)
>
> **Status:** ✅ Implemented. Persistent AppHeader, nested tab groups, shared CandidateDetailScreen, back navigation.
>
> **Depends on:** [PLAN-00](./PLAN-00-contest-round-architecture.md) Phase 1 (complete) — uses `selectCurrentRoundLabel`, `selectBrowsingDistrict`

### Review Notes (Mar 25 round 2 feedback)

**Confirmed ready to ship.** Reviewer called this "solid, senior-level navigation architecture." Three gaps to address during implementation:

1. **Route duplication drift risk:** `(feed)/candidate/[id]` and `(leaderboard)/candidate/[id]` are the same screen in two locations. **Fix:** Extract shared screen to `src/screens/CandidateDetailScreen.tsx`, both routes import it.

2. **Deep link ambiguity:** Plan doesn't define which tab becomes active on deep link to candidate detail. **Fix:** Default to `(feed)` tab for unknown/deep-linked candidate detail. If an explicit `from` param is present, use it.

3. **AppHeader performance:** Pulling `selectedBrowsingDistrict` and `currentRoundLabel` without memoization or loading state could cause excessive re-renders. **Fix:** Use primitive selectors (strings, not objects) and handle loading state in AppHeader.

**Quiz decision (locked):** Quiz is standalone (`app/quiz.tsx`), NOT part of onboarding. Treat as a tool, not a gate. This resolves the PLAN-10 conflict.

## Summary

Consolidate the persistent header, tab bar persistence, and back/cancel navigation into one coordinated change. The previous attempt broke touch handling by wrapping `<Tabs>` in a `<View>`. This plan avoids that entirely.

## Goals

1. **Persistent header** on all tab screens: AMSP logo (left), round label (center), district selector (right)
2. **Tab bar visible** on settings and candidate detail screens
3. **Back/cancel buttons** work correctly everywhere, including deep links and cold starts
4. **No touch regressions** — never wrap navigators in extra View components

## Current Route Structure

```
app/
├── _layout.tsx              ← Root Stack
│   ├── (tabs)/              ← Tab navigator (4 tabs)
│   │   ├── index.tsx        ← Home
│   │   ├── for-you.tsx      ← For You
│   │   ├── leaderboard.tsx  ← Leaderboard
│   │   └── profile.tsx      ← Profile (hub for settings)
│   ├── (auth)/              ← Auth stack (login, register, verify, onboarding)
│   ├── (candidate)/         ← Candidate stack (apply, creation, metrics, messages)
│   ├── settings/            ← Settings stack (personal-info, issues, endorsements, dealbreakers)
│   ├── candidate/[id].tsx   ← Candidate detail (standalone)
│   └── quiz.tsx             ← Quiz (standalone)
```

**Problem:** When navigating to `/settings/*`, `/candidate/[id]`, or `/quiz`, the tab bar disappears because these routes are outside the `(tabs)` group.

## Proposed Route Structure

```
app/
├── _layout.tsx              ← Root Stack (auth gate + main app)
│   ├── (auth)/              ← Auth stack (unchanged)
│   ├── (main)/              ← NEW: Main app group with persistent tabs
│   │   ├── _layout.tsx      ← Tab navigator (4 tabs + hidden routes)
│   │   ├── (home)/          ← Home tab stack
│   │   │   ├── _layout.tsx  ← Stack with AppHeader
│   │   │   └── index.tsx    ← Home screen
│   │   ├── (feed)/          ← For You tab stack
│   │   │   ├── _layout.tsx  ← Stack with AppHeader
│   │   │   ├── index.tsx    ← For You feed
│   │   │   └── candidate/[id].tsx  ← Candidate detail (tab bar stays!)
│   │   ├── (leaderboard)/   ← Leaderboard tab stack
│   │   │   ├── _layout.tsx  ← Stack with AppHeader
│   │   │   ├── index.tsx    ← Leaderboard
│   │   │   └── candidate/[id].tsx  ← Candidate detail from leaderboard
│   │   ├── (profile)/       ← Profile tab stack
│   │   │   ├── _layout.tsx  ← Stack (no AppHeader — profile has own header)
│   │   │   ├── index.tsx    ← Profile screen
│   │   │   ├── personal-info.tsx
│   │   │   ├── issues.tsx
│   │   │   └── endorsements.tsx
│   │   └── quiz.tsx         ← Quiz (hidden tab, modal-style)
│   └── (candidate)/         ← Candidate management (unchanged, outside tabs)
```

### Key Decisions

1. **Candidate detail lives under BOTH Feed and Leaderboard** — same component, different parent tab. This way the tab bar shows the correct active tab and back navigation returns to the originating list.

2. **Settings screens move under Profile tab** — tab bar stays visible, back button returns to profile.

3. **Quiz stays as a modal/hidden tab route** — it's a focused task that doesn't need the tab bar, but can still be pushed from within the tab context.

4. **Candidate management (apply, creation, metrics, messages) stays outside tabs** — these are full-screen flows for candidate users, not browsing flows.

5. **`dealbreakers.tsx` is NOT moved** — it will be removed per product decision (PLAN-10).

## AppHeader Component

**File:** `src/components/layout/AppHeader.tsx`

```
┌──────────────────────────────────────┐
│  [AMSP Logo]   Round Label   [PA-01] │
└──────────────────────────────────────┘
```

- **Left:** AMSP logo image (120x36)
- **Center:** Current round label from `selectCurrentRoundLabel`
- **Right:** District selector pill reading/writing `selectedBrowsingDistrict`

### Critical Rules

- **Reads `selectedBrowsingDistrict`** from userStore (NOT `userProfile.district`)
- **Writes `setSelectedBrowsingDistrict()`** — never mutates verified district identity
- **Works for anonymous users** — anonymous users can browse any district
- **Rendered via `screenOptions.header` on the Stack** inside each tab, NOT as a View wrapper around Tabs

### Rendering Approach (touch-safe)

```tsx
// In each tab's _layout.tsx (e.g., app/(main)/(home)/_layout.tsx)
<Stack
  screenOptions={{
    header: () => <AppHeader />,  // ← Custom header, NOT a View wrapper
  }}
>
  <Stack.Screen name="index" />
</Stack>
```

This uses Expo Router's built-in `header` prop, which renders the header as part of the navigation chrome — no extra View wrapping Tabs.

## Back/Cancel Navigation

### Shared Helper

```ts
// src/utils/navigation.ts
import { router } from 'expo-router';

/**
 * Navigate back safely. If no back stack exists (deep link, cold start),
 * fall back to a specified route.
 */
export function goBack(fallback: string = '/(main)/(home)') {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallback);
  }
}
```

### Rules

| Pattern | Use | Example |
|---------|-----|---------|
| `goBack()` | Cancel/dismiss buttons | Settings back, quiz close |
| `router.replace()` | Post-auth redirects (prevent back to login) | After sign-in, after onboarding |
| `router.push()` | Forward navigation | Profile → Settings, Feed → Candidate |

### Screens to Update

| Screen | Current | Change to |
|--------|---------|-----------|
| `verify-identity.tsx` (skip) | `router.replace('/(auth)/onboarding/issues')` | `goBack('/(main)/(home)')` |
| `(candidate)/apply.tsx` (cancel) | `router.back()` | `goBack('/(main)/(profile)')` |
| `settings/_layout.tsx` (back) | `router.back()` | Remove — settings will be nested in profile tab with native back |
| `candidate/[id].tsx` (back) | `router.back()` / `router.replace(from)` | Native stack back (automatic when nested in tab) |

### Legitimate `router.replace()` calls (DO NOT change)

- After sign-out → `/(auth)/login`
- After sign-in → `/(main)`
- After onboarding complete → `/(main)`
- After registration → `/(main)`

## Route Path Migration

| Old Path | New Path | Files to Update |
|----------|----------|-----------------|
| `/(tabs)` | `/(main)` | login.tsx, register.tsx, dealbreakers.tsx |
| `/(tabs)/for-you` | `/(main)/(feed)` | VoterHome.tsx, endorsements.tsx, profile.tsx |
| `/(tabs)/leaderboard` | `/(main)/(leaderboard)` | (internal only) |
| `/(tabs)/profile` | `/(main)/(profile)` | apply.tsx |
| `/settings/personal-info` | `/(main)/(profile)/personal-info` | profile.tsx |
| `/settings/issues` | `/(main)/(profile)/issues` | profile.tsx |
| `/settings/endorsements` | `/(main)/(profile)/endorsements` | profile.tsx |
| `/settings/dealbreakers` | `/(main)/(profile)/dealbreakers` | profile.tsx (REMOVE — dealbreakers being deleted) |
| `/candidate/[id]` | `/(main)/(feed)/candidate/[id]` | PSACard.tsx, FullScreenPSA.tsx |
| `/candidate/[id]` (from leaderboard) | `/(main)/(leaderboard)/candidate/[id]` | leaderboard.tsx |
| `/quiz` | `/(main)/quiz` | VoterHome.tsx, QuizPromptCard.tsx |

## Implementation Steps

### Step 1: Create AppHeader component
- `src/components/layout/AppHeader.tsx`
- Uses `selectCurrentRoundLabel`, `selectBrowsingDistrict`, `setSelectedBrowsingDistrict`
- No navigation logic, pure display + district selector

### Step 2: Create new route structure
- Create `app/(main)/` directory with `_layout.tsx` (Tabs)
- Create nested stacks: `(home)/`, `(feed)/`, `(leaderboard)/`, `(profile)/`
- Each nested stack uses `screenOptions.header` for AppHeader
- Move existing screen content into new locations

### Step 3: Update all router.push/replace calls
- Follow the path migration table above
- Use find-and-replace with verification

### Step 4: Create `goBack()` helper and update cancel/back buttons
- Create `src/utils/navigation.ts`
- Update screens per the back navigation table

### Step 5: Remove old routes
- Delete `app/(tabs)/` directory
- Delete `app/settings/` directory (screens moved to profile tab)
- Delete `app/candidate/[id].tsx` (moved into feed and leaderboard stacks)

### Step 6: Test every navigation path
- All 4 tabs load and respond to touch
- Tab bar stays visible on: candidate detail, settings screens, endorsements
- Tab bar disappears on: auth screens, candidate apply/creation
- Back button works on all settings screens
- Candidate detail back returns to correct originating tab
- Deep link to candidate detail shows correct tab bar state
- Quiz opens and closes correctly
- District selector updates feed and leaderboard content

## Constraints

- **NEVER wrap `<Tabs>` or `<Stack>` in a `<View>`** — this broke touch in the previous attempt
- **AppHeader goes in `screenOptions.header`**, not as a sibling View
- **Anonymous users must be able to browse** — the main app shell is not auth-gated (auth gate is on specific actions like endorse)
- **Web compatibility** — web uses `<Slot>` instead of `<Stack>`, so AppHeader on web needs the same SafeAreaView→View alias pattern used elsewhere

## What This Plan Does NOT Do

- Does not implement PLAN-00 Phase 2 (elimination, round-scoped endorsements)
- Does not add bookmark system (PLAN-12)
- Does not remove dealbreakers (PLAN-10 — separate task)
- Does not change candidate management screens (apply, creation, metrics, messages)
