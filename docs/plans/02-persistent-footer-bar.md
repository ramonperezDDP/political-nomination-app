# PLAN: Persistent Footer/Tab Bar on All Screens

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

### 1. Move settings screens into Profile tab

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
```tsx
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

### 2. Move candidate detail into For You tab

```
app/(tabs)/for-you/
  _layout.tsx         ← Stack navigator
  index.tsx           ← current for-you.tsx
  candidate/[id].tsx  ← moved from app/candidate/[id].tsx
```

### 3. Update `app/(tabs)/_layout.tsx`

Change tab screen names to reference the new directory-based routes:

```tsx
<Tabs.Screen name="profile" ... />
// becomes a directory-based route, Expo Router auto-discovers _layout.tsx
```

### 4. Update all `router.push()` calls

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
