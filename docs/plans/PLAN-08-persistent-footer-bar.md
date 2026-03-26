# PLAN: Persistent Footer/Tab Bar on All Screens — SUPERSEDED

> **SUPERSEDED by [PLAN-17: Unified App Shell](./PLAN-17-unified-app-shell.md)** which combines PLAN-07, PLAN-08, and PLAN-15 into one coordinated navigation restructure. Do not implement this plan independently.

### Review Notes (Mar 25 feedback)

**Stale dealbreakers reference:** Plan still moves `dealbreakers.tsx` into the Profile tab, but PLAN-10 proposes removing dealbreakers entirely. These two plans conflict.

**Bigger than it looks:** Moving `app/settings/*` and `app/candidate/[id].tsx` into the tab context changes route paths, every `router.push()` target, deep-link behavior, stack history, and back-button semantics. This is a navigation migration, not a file-move.

**Before implementation, requires:**
- Full route inventory (current → proposed path mapping)
- Decision on where candidate detail lives (only under For You? reachable from Leaderboard, Home, Endorsements?)
- Deep-link expectations
- Clarity on which anonymous-access screens live inside vs outside tabs (app is no longer purely authenticated — anonymous access is core)

**Recommendation:** Rewrite PLAN-07, PLAN-08, and PLAN-15 as one unified app-shell/navigation plan.

## Summary

Ensure the bottom tab bar is persistent and visible on all screens within the authenticated app experience, not just on tab screens.

## Current State

- The tab bar is defined in `app/(tabs)/_layout.tsx:26-39` and only appears on the 4 tab screens  
- Stack screens like `candidate/[id].tsx`, `settings/*`, and `(candidate)/*` navigate away from the tab layout, hiding the tab bar entirely

## Files to Modify

- `app/_layout.tsx` — restructure routing so stack screens render inside the tab layout  
- `app/(tabs)/_layout.tsx` — potentially add nested stacks within tabs  
- `app/settings/_layout.tsx` — nest within Profile tab  
- `app/candidate/[id].tsx` — move into tab context

## Implementation Details

### Approach: Nest Stacks Inside Tabs

The Expo Router way to keep tabs visible is to nest stack navigators inside each tab. Screens that should show the tab bar must be defined within the `(tabs)` group.

### 1\. Move settings screens into Profile tab

Currently settings is a top-level route. Move it to be a nested stack under the Profile tab:

```
app/(tabs)/profile/
  _layout.tsx        ← Stack navigator
  index.tsx          ← current profile.tsx
  personal-info.tsx  ← moved from app/settings/
  dealbreakers.tsx   ← moved from app/settings/
  issues.tsx         ← moved from app/settings/
  endorsements.tsx   ← moved from app/settings/
```

In `app/(tabs)/profile/_layout.tsx`:

```
import { Stack } from 'expo-router';

export default function ProfileLayout() {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="personal-info" options={{ title: 'Personal Information' }} />
      <Stack.Screen name="dealbreakers" options={{ title: 'Dealbreakers' }} />
      <Stack.Screen name="issues" options={{ title: 'Policy Preferences' }} />
      <Stack.Screen name="endorsements" options={{ title: 'My Endorsements' }} />
    </Stack>
  );
}
```

### 2\. Move candidate detail into For You tab

```
app/(tabs)/for-you/
  _layout.tsx         ← Stack navigator
  index.tsx           ← current for-you.tsx
  candidate/[id].tsx  ← moved from app/candidate/[id].tsx
```

### 3\. Update `app/(tabs)/_layout.tsx`

Change tab screen names to reference the new directory-based routes:

```
<Tabs.Screen name="profile" ... />
// becomes a directory-based route, Expo Router auto-discovers _layout.tsx
```

### 4\. Update all `router.push()` calls

All navigation calls like `router.push('/settings/endorsements')` become `router.push('/(tabs)/profile/endorsements')`.

Affected files:

- `app/(tabs)/profile/index.tsx` — menu item onPress handlers  
- `src/components/home/VoterHome.tsx` — "Browse Candidates" button  
- Any file that links to `/candidate/[id]`

## Testing

- Tab bar visible when viewing candidate detail pages  
- Tab bar visible when in settings screens  
- Back navigation still works correctly within nested stacks  
- Deep links still resolve properly

