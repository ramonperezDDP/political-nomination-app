# PLAN: Persistent Title Bar with Logo and District — NEEDS REDESIGN

> **Updated 2026-03-25:** Status reset after branch reset. AppHeader component does not exist in current codebase. PLAN-00 Phase 1 selectors (`selectCurrentRoundLabel`) are now available for use.

> **BLOCKED:** Do NOT implement independently. Must be designed together with PLAN-08 (footer/tabs) and PLAN-15 (back button) as a single app-shell/navigation plan. See review notes below.

> **Related:** [PLAN-00: Contest Round Architecture](./PLAN-00-contest-round-architecture.md) — the round indicator in the title bar uses `selectCurrentRoundLabel` from PLAN-00.

> **WARNING:** The previous implementation wrapped `<Tabs>` in a `<View>` which broke touch handling. Do NOT wrap navigators in extra View components. Use `headerShown: false` on individual tabs and render AppHeader INSIDE each screen's SafeAreaView, or use the Tabs `screenOptions.header` prop.

### Review Notes (Mar 25 feedback)

**Self-contradiction:** This plan warns not to wrap `<Tabs>` in a `<View>`, then shows an implementation that does exactly that. The rendering approach must be redesigned — either use `screenOptions.header` on the Tabs navigator, or render AppHeader inside each screen.

**District selector uses wrong state:** The plan writes to `userProfile.district`, but Plan 02 already established `selectedBrowsingDistrict` in the user store for content browsing. The header district selector must:
- Read and write `selectedBrowsingDistrict` (not `userProfile.district`)
- Work for anonymous users (who have no verified districts)
- Never mutate verification-derived district identity

**Stale text:** References to "no district concept in the UI" are outdated — the district toggle and browsing district concept are already established in Plan 02.

**Recommendation:** Rewrite PLAN-07, PLAN-08, and PLAN-15 as one unified app-shell/navigation plan before implementation.

## Summary

Make the title bar persistent across all screens with the AMSP logo on the left and a district selector on the right. Allow toggling between districts (PA-01 / PA-02) with pastel color-coding, and display the current contest round.

## Current State

- The header with logo and tagline only exists on the Home screen (`app/(tabs)/index.tsx:22-31`)  
- Other tab screens (For You, Leaderboard, Profile) have their own headers or none  
- No shared header component exists  
- No district concept in the UI (only `user.district` field in types)

## Files to Create

- `src/components/layout/AppHeader.tsx` — new shared header component

## Files to Modify

- `app/(tabs)/_layout.tsx` — add persistent header above tabs  
- `app/(tabs)/index.tsx` — remove inline header  
- `app/(tabs)/for-you.tsx` — remove inline header  
- `app/(tabs)/leaderboard.tsx` — remove inline header  
- `app/(tabs)/profile.tsx` — remove inline header  
- `src/constants/theme.ts` — add pastel district colors  
- `src/stores/configStore.ts` — add district state and round display  
- `src/types/index.ts` — add district/round types if needed

## Implementation Details

### 1\. Add district pastel colors to theme (`src/constants/theme.ts`)

```ts
// Add after brandColors definition (line 7)
const districtColors = {
  'PA-01': '#FFB6C1', // pastel pink
  'PA-02': '#ADD8E6', // pastel blue
};
```

### 2\. Create `AppHeader` component (`src/components/layout/AppHeader.tsx`)

```
import React, { useState } from 'react';
import { StyleSheet, View, Image, Pressable } from 'react-native';
import { Text, useTheme, Menu } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useConfigStore, useUserStore } from '@/stores';

const DISTRICT_COLORS: Record<string, string> = {
  'PA-01': '#FFB6C1',
  'PA-02': '#ADD8E6',
};

// Round labels now come from the contestRounds collection via PLAN-00.
// Use the selectCurrentRoundLabel selector instead of hardcoded labels:
//   import { selectCurrentRoundLabel } from '@/stores';
//   const roundLabel = useConfigStore(selectCurrentRoundLabel);

export default function AppHeader() {
  const theme = useTheme();
  const { partyConfig } = useConfigStore();
  const { userProfile, updateProfile } = useUserStore();
  const [menuVisible, setMenuVisible] = useState(false);

  const currentDistrict = userProfile?.district || 'PA-01';
  const roundLabel = useConfigStore(selectCurrentRoundLabel); // From PLAN-00

  const handleDistrictChange = async (district: string) => {
    setMenuVisible(false);
    if (userProfile?.id) {
      await updateProfile(userProfile.id, { district });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      {/* Logo — left */}
      <Image
        source={require('../../../assets/amsp-logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />

      {/* Round indicator — center */}
      <View style={styles.roundContainer}>
        <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
          {roundLabel}
        </Text>
      </View>

      {/* District selector — right */}
      <Menu
        visible={menuVisible}
        onDismiss={() => setMenuVisible(false)}
        anchor={
          <Pressable
            onPress={() => setMenuVisible(true)}
            style={[
              styles.districtButton,
              { backgroundColor: DISTRICT_COLORS[currentDistrict] || '#E0E0E0' },
            ]}
          >
            <Text variant="labelMedium" style={styles.districtText}>
              {currentDistrict}
            </Text>
            <MaterialCommunityIcons name="chevron-down" size={16} />
          </Pressable>
        }
      >
        {['PA-01', 'PA-02'].map((district) => (
          <Menu.Item
            key={district}
            onPress={() => handleDistrictChange(district)}
            title={district}
            leadingIcon={currentDistrict === district ? 'check' : undefined}
          />
        ))}
      </Menu>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  logo: {
    width: 120,
    height: 36,
  },
  roundContainer: {
    flex: 1,
    alignItems: 'center',
  },
  districtButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  districtText: {
    fontWeight: '600',
    marginRight: 4,
  },
});
```

### 3\. Integrate into tab layout (`app/(tabs)/_layout.tsx`)

Replace the current layout to wrap tabs with the persistent header:

```
// Add import
import AppHeader from '@/components/layout/AppHeader';

// In the return, wrap Tabs with a parent View:
return (
  <View style={{ flex: 1 }}>
    <SafeAreaView edges={['top']} style={{ backgroundColor: theme.colors.surface }}>
      <AppHeader />
    </SafeAreaView>
    <Tabs
      screenOptions={{
        // ... existing options
        headerShown: false, // ensure all tab screens hide their header
      }}
    >
      {/* ... existing tab screens, all with headerShown: false */}
    </Tabs>
  </View>
);
```

### 4\. Remove duplicate headers from tab screens

- **`app/(tabs)/index.tsx`**: Remove lines 22-31 (the `<View style={styles.header}>` block with logo and tagline)  
- **`app/(tabs)/leaderboard.tsx`**: Already uses `headerShown: false` but has its own title; keep the title row but remove SafeAreaView top edge  
- **`app/(tabs)/for-you.tsx`**: Remove SafeAreaView `edges={['top']}`  
- **`app/(tabs)/profile.tsx`**: Remove SafeAreaView `edges={['top']}`

## Testing

- Verify header appears on all 4 tab screens  
- Verify district toggle changes color (pink for PA-01, blue for PA-02)  
- Verify round label updates based on `partyConfig.currentRoundId` (via `selectCurrentRoundLabel` from the `contestRounds` collection)  
- Verify header does not appear on auth/onboarding screens  
- Test on iOS simulator and web

