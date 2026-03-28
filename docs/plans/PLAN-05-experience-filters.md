# Plan 05: Experience Filters & Location Maps — ✅ COMPLETE

> **Completed 2026-03-27.** Custom ExperienceMenu dropdown, LocationMapModal with SVG zone maps for PA-01/PA-02, MassEndorseButton with district gating. Uses custom dropdown instead of Paper Menu to avoid Portal touch-blocking. All filter logic and gating selectors functional.
>
> **Updated 2026-03-28:** PLAN-10A removed dealbreakers and dropped "Top Picks" filter. Feed now has 3 filters (Explore, My Area, My Issues). "My Issues" represents positive overlap only — no exclusion logic. `selectCanSeeDealbreakers` removed. 4th slot reserved for future 10C2 scoring-based filter.

**Feedback:** Experience dropdown menu with 4 filters: Random, Location (with PA-01/PA-02 maps), Issues, Most Important Issues. Anonymous mode — no email or account required to enter the app. Users can apply filters and then mass endorse all candidates remaining after filtering. Simplified SVG maps for the beta. PNs provide their address for zone assignment. Users can view candidates in other districts but cannot endorse outside their own.

---

## Current State (Post-Plan 04)

### What Already Exists

**`src/components/feed/ExperienceMenu.tsx`** — **Stub** (cycle-through on tap). Cycles through 4 filters: Explore, My Issues, Top Picks, My Area. No dropdown, no gating, no lock icons. Comment on line 26: `// Stub: cycle through filters on tap — full dropdown in Plan 05`.

**`src/components/feed/MassEndorseButton.tsx`** — **Fully implemented**. Shows "Endorse all N" when non-random filter active, user is fully verified, and endorsable candidates exist. Uses `ConfirmModal`. Filters by district match. Already integrated in `for-you.tsx`.

**`app/(tabs)/for-you.tsx`** — Full-screen TikTok-style paging FlatList (Plan 04). Already has:
- `experienceFilter` state (default: `canSeeAlignment ? 'issues' : 'random'`)
- Auto-switch from `'random'` to `'issues'` when quiz completed
- `ExperienceMenu` rendered at `top: insets.top + 8` (right side)
- `MassEndorseButton` rendered at `top: insets.top + 48` (left side)
- `QuizPromptCard` prepended when quiz not completed
- Simplified filter logic in `useMemo`:
  - `issues`: `item.matchedIssues.length > 0`
  - `most_important`: `!item.hasDealbreaker`
  - `location`: returns all items (no-op)
  - `random`: `Math.random() - 0.5` sort

**`src/types/index.ts` / `index.web.ts`** — `Candidate` has both `district: string` (required) and `zone?: string` (optional). `CandidatePreview` has `district: string` but **no `zone` field**.

**`src/components/feed/index.ts`** — Already exports ExperienceMenu and MassEndorseButton.

**`react-native-svg`** — Already a dependency (v15.8.0) but unused in the codebase.

### What Does NOT Exist Yet

- No dropdown/menu in ExperienceMenu (just a cycle-through stub)
- No filter gating (locked/disabled state for Issues, Most Important)
- No `onLocationPress` callback support in ExperienceMenu
- No `LocationMapModal` component
- No `selectedLocation` / `locationModalVisible` state in for-you.tsx
- No `selectedBrowsingDistrict` usage in for-you.tsx feed
- No `zone` on `CandidatePreview` type
- **No `district` or `zone` assigned in `seedCandidates()`** (both native and web) — candidates seeded without these fields
- **No `district` assigned in `processApplication` Cloud Function** when approving candidates
- No district-based feed filtering in `getCandidatesForFeed()` — currently fetches all candidates regardless of browsing district
- `generateFeedItem()` in for-you.tsx does not pass `zone` to the CandidatePreview object

---

## Proposed Design

### Experience Dropdown

A dropdown button in the **top-right corner** of the For You page. Selecting a filter changes which PSAs appear in the feed.

**Filter gating uses Plan 01's capability selectors.** Anonymous users (no account) and authenticated users without quiz completion see some filters locked. Random and Location are always available — no account needed.

| Filter | Required State | Plan 01 Selector |
| :---- | :---- | :---- |
| Random | None (anonymous OK) | Always available |
| Location | None (anonymous OK) | Always available |
| Issues | Questionnaire complete (1+ question) | `selectCanSeeAlignment` |
| Most Important | Questionnaire complete AND Dealbreakers complete | `selectCanSeeAlignment` AND `selectCanSeeDealbreakers` |

```
┌──────────────────────────────────────────┐
│                              [Issues ▼]  │
│                                          │
│   (Dropdown opens:)                      │
│   ┌────────────────────────┐             │
│   │ ○ Random               │             │
│   │ ○ Location             │             │
│   │ ● Issues               │             │
│   │ 🔒 Most Important      │             │
│   └────────────────────────┘             │
│                                          │
│        [ FULL SCREEN PSA ]               │
│                                          │
└──────────────────────────────────────────┘
```

---

## Step 1: Data Prerequisites

### 1a. Add `zone` to `CandidatePreview` type

**Files:** `src/types/index.ts` and `src/types/index.web.ts`

Add `zone?: string;` after `district` in the `CandidatePreview` interface:

```ts
export interface CandidatePreview {
  id: string;
  displayName: string;
  photoUrl?: string;
  gender?: Gender;
  topIssues: string[];
  endorsementCount: number;
  averageSpectrum: number;
  district: string;
  zone?: string;     // NEW — virtual polling location zone
}
```

### 1b. Pass `zone` in `generateFeedItem()` (`app/(tabs)/for-you.tsx`)

Add `zone: candidate.zone` to the candidate object in `generateFeedItem` (~line 82):

```ts
candidate: {
  id: candidate.id,
  displayName: user?.displayName || 'Candidate',
  // ... existing fields ...
  district: candidate.district,
  zone: candidate.zone,        // NEW
},
```

### 1c. Assign `district` and `zone` in `seedCandidates()` (CRITICAL)

**Files:** `src/services/firebase/firestore.ts` (~line 1536) and `src/services/firebase/firestore.web.ts` (~line 804)

Currently seeded candidates have **no district or zone fields**. This means:
- Location filter cannot work (no district/zone to match against)
- Endorsement district-gating fails silently (candidate.district is undefined)

Add district/zone assignment to the seed batch:

```ts
// Zone definitions
const ZONES: Record<string, string[]> = {
  'PA-01': ['pa01-north', 'pa01-central', 'pa01-south'],
  'PA-02': ['pa02-west', 'pa02-center', 'pa02-northeast', 'pa02-south'],
};
const DISTRICTS = Object.keys(ZONES);

// Inside the seed loop, before batch.set(candidateRef, {...}):
const district = DISTRICTS[i % DISTRICTS.length]; // Alternate between PA-01 and PA-02
const districtZones = ZONES[district];
const zone = districtZones[Math.floor(Math.random() * districtZones.length)];

// Add to the candidate document:
batch.set(candidateRef, {
  // ... existing fields ...
  district,
  zone,
} as Candidate);
```

### 1d. Assign `district` in `processApplication` Cloud Function

**File:** `functions/src/candidates/processApplication.ts` (~line 110)

The `approveCandidate()` function creates a candidate record without `district`. For real candidates, district should come from the application data (address-based). For now, default to the first available district or pull from application:

```ts
await candidateRef.set({
  // ... existing fields ...
  district: applicationData.district || 'PA-01', // From application or default
  zone: applicationData.zone || '',               // From address lookup or empty
});
```

---

## Step 2: Replace ExperienceMenu Stub

**File:** `src/components/feed/ExperienceMenu.tsx` — **Full rewrite** (replacing stub)

Key changes from stub:
- Add React Native Paper `Menu` with proper dropdown behavior
- Add filter gating via `selectCanSeeAlignment` and `selectCanSeeDealbreakers`
- Add `onLocationPress` callback prop for opening location modal
- Lock icon + disabled description for gated filters
- Check icon for selected filter
- Style prop stays `ViewStyle | ViewStyle[]` for compatibility with existing `for-you.tsx` usage

```tsx
import React, { useState } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Menu, Button } from 'react-native-paper';
import { useUserStore, selectCanSeeAlignment, selectCanSeeDealbreakers } from '@/stores';

export type ExperienceFilter = 'random' | 'location' | 'issues' | 'most_important';

interface ExperienceMenuProps {
  selectedFilter: ExperienceFilter;
  onFilterChange: (filter: ExperienceFilter) => void;
  onLocationPress?: () => void;
  style?: ViewStyle | ViewStyle[];
}

interface FilterOption {
  id: ExperienceFilter;
  label: string;
  icon: string;
  description: string;
  disabledDescription: string;
}

const FILTER_OPTIONS: FilterOption[] = [
  {
    id: 'random',
    label: 'Explore',
    icon: 'shuffle-variant',
    description: 'All PSAs in random order',
    disabledDescription: '',
  },
  {
    id: 'location',
    label: 'My Area',
    icon: 'map-marker',
    description: 'PNs from a specific area',
    disabledDescription: '',
  },
  {
    id: 'issues',
    label: 'My Issues',
    icon: 'clipboard-list',
    description: 'PNs matching your policy positions',
    disabledDescription: 'Complete the quiz to unlock',
  },
  {
    id: 'most_important',
    label: 'Top Picks',
    icon: 'star',
    description: 'Exclude PNs who oppose your dealbreakers',
    disabledDescription: 'Complete the quiz and set dealbreakers to unlock',
  },
];

export default function ExperienceMenu({
  selectedFilter,
  onFilterChange,
  onLocationPress,
  style,
}: ExperienceMenuProps) {
  const [visible, setVisible] = useState(false);

  const canSeeAlignment = useUserStore(selectCanSeeAlignment);
  const canSeeDealbreakers = useUserStore(selectCanSeeDealbreakers);

  const selectedOption = FILTER_OPTIONS.find((o) => o.id === selectedFilter);

  const isFilterDisabled = (filterId: ExperienceFilter): boolean => {
    switch (filterId) {
      case 'issues':
        return !canSeeAlignment;
      case 'most_important':
        return !canSeeAlignment || !canSeeDealbreakers;
      default:
        return false;
    }
  };

  const handleSelect = (filter: ExperienceFilter) => {
    if (filter === 'location' && onLocationPress) {
      onLocationPress();
    }
    onFilterChange(filter);
    setVisible(false);
  };

  return (
    <View style={[styles.container, style]}>
      <Menu
        visible={visible}
        onDismiss={() => setVisible(false)}
        anchor={
          <Button
            mode="contained-tonal"
            compact
            onPress={() => setVisible(true)}
            icon={selectedOption?.icon}
            contentStyle={styles.buttonContent}
            labelStyle={styles.buttonLabel}
            style={styles.button}
          >
            {selectedOption?.label}
          </Button>
        }
        contentStyle={styles.menuContent}
      >
        {FILTER_OPTIONS.map((option) => {
          const disabled = isFilterDisabled(option.id);
          const isSelected = selectedFilter === option.id;

          return (
            <Menu.Item
              key={option.id}
              onPress={() => handleSelect(option.id)}
              title={option.label}
              description={disabled ? option.disabledDescription : option.description}
              leadingIcon={disabled ? 'lock' : option.icon}
              trailingIcon={isSelected ? 'check' : undefined}
              disabled={disabled}
              titleStyle={disabled ? styles.disabledText : undefined}
            />
          );
        })}
      </Menu>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 16,
    zIndex: 100,
  },
  button: {
    borderRadius: 20,
  },
  buttonContent: {
    height: 36,
  },
  buttonLabel: {
    fontSize: 13,
    color: '#fff',
  },
  menuContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  disabledText: {
    opacity: 0.4,
  },
});
```

**Note:** Filter labels use the existing stub names (Explore, My Issues, Top Picks, My Area) for UI consistency with Plan 04's labels, rather than the original plan's "Random" / "Location" / "Issues" / "Most Important".

---

## Step 3: Create LocationMapModal

**File:** `src/components/feed/LocationMapModal.tsx` — **New file**

Uses `react-native-svg` (already installed v15.8.0, unused until now) and React Native Paper `Portal` + `Modal`.

```tsx
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Modal, Portal, Text, Button, useTheme } from 'react-native-paper';
import Svg, { Path, G, Text as SvgText } from 'react-native-svg';

interface LocationMapModalProps {
  visible: boolean;
  onDismiss: () => void;
  onLocationSelect: (locationId: string) => void;
  district: string; // 'PA-01' or 'PA-02'
}

const PA01_ZONES = [
  { id: 'pa01-north', label: 'North', path: 'M50,10 L150,10 L150,80 L50,80 Z', center: { x: 100, y: 45 } },
  { id: 'pa01-central', label: 'Central', path: 'M50,80 L150,80 L150,150 L50,150 Z', center: { x: 100, y: 115 } },
  { id: 'pa01-south', label: 'South', path: 'M50,150 L150,150 L150,220 L50,220 Z', center: { x: 100, y: 185 } },
];

const PA02_ZONES = [
  { id: 'pa02-west', label: 'West Philly', path: 'M10,50 L90,50 L90,180 L10,180 Z', center: { x: 50, y: 115 } },
  { id: 'pa02-center', label: 'Center City', path: 'M90,50 L170,50 L170,180 L90,180 Z', center: { x: 130, y: 115 } },
  { id: 'pa02-northeast', label: 'Northeast', path: 'M170,10 L250,10 L250,120 L170,120 Z', center: { x: 210, y: 65 } },
  { id: 'pa02-south', label: 'South Philly', path: 'M90,180 L200,180 L200,240 L90,240 Z', center: { x: 145, y: 210 } },
];

export default function LocationMapModal({
  visible,
  onDismiss,
  onLocationSelect,
  district,
}: LocationMapModalProps) {
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const theme = useTheme();
  const zones = district === 'PA-02' ? PA02_ZONES : PA01_ZONES;

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.modalContent}
      >
        <Text variant="titleLarge" style={styles.title}>
          {district} — Select Area
        </Text>
        <Text variant="bodySmall" style={styles.subtitle}>
          Tap a zone to see candidates from that area
        </Text>

        <View style={styles.mapContainer}>
          <Svg width="100%" height={260} viewBox="0 0 260 260">
            {zones.map((zone) => {
              const isSelected = selectedZone === zone.id;
              return (
                <G key={zone.id}>
                  <Path
                    d={zone.path}
                    fill={isSelected ? theme.colors.primaryContainer : '#e8e8e8'}
                    stroke={isSelected ? theme.colors.primary : '#999'}
                    strokeWidth={isSelected ? 2.5 : 1}
                    onPress={() => setSelectedZone(zone.id)}
                  />
                  <SvgText
                    x={zone.center.x}
                    y={zone.center.y}
                    textAnchor="middle"
                    fontSize={11}
                    fill={isSelected ? theme.colors.primary : '#555'}
                    fontWeight={isSelected ? 'bold' : 'normal'}
                  >
                    {zone.label}
                  </SvgText>
                </G>
              );
            })}
          </Svg>
        </View>

        <View style={styles.actions}>
          <Button mode="outlined" onPress={onDismiss}>
            Cancel
          </Button>
          <Button
            mode="contained"
            disabled={!selectedZone}
            onPress={() => {
              if (selectedZone) {
                onLocationSelect(selectedZone);
                onDismiss();
              }
            }}
          >
            Show Candidates
          </Button>
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modalContent: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 16,
    padding: 24,
  },
  title: { textAlign: 'center', marginBottom: 4 },
  subtitle: { textAlign: 'center', color: '#666', marginBottom: 16 },
  mapContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 8,
    marginBottom: 16,
  },
  actions: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
});
```

### SVG Map Data

The SVG paths above are simplified placeholders for the beta. For production, district boundaries can be obtained from the US Census Bureau and converted to SVG using mapshaper.org, or clean SVG maps can be created in Figma/Illustrator.

---

## Step 4: Upgrade Filter Logic in `app/(tabs)/for-you.tsx`

### Current simplified filter logic (lines 142-154):

```ts
const filteredItems = useMemo(() => {
  switch (experienceFilter) {
    case 'issues':
      return feedItems.filter((item) => item.matchedIssues.length > 0);
    case 'most_important':
      return feedItems.filter((item) => !item.hasDealbreaker);
    case 'location':
      return feedItems;
    case 'random':
    default:
      return [...feedItems].sort(() => Math.random() - 0.5);
  }
}, [feedItems, experienceFilter]);
```

### Replace with full filter implementations:

```ts
const filteredItems = useMemo(() => {
  switch (experienceFilter) {
    case 'issues':
      return feedItems.filter((item) => {
        if (item.matchedIssues.length === 0) return false;
        const userResponses = user?.questionnaireResponses || [];
        return item.candidatePositions.some((cp) => {
          const userResponse = userResponses.find((r) => r.issueId === cp.issueId);
          if (!userResponse) return false;
          const userValue = Number(userResponse.answer);
          return (userValue >= 0 && cp.spectrumPosition >= 0) ||
                 (userValue < 0 && cp.spectrumPosition < 0);
        });
      });

    case 'most_important': {
      const userDealbreakers = user?.dealbreakers || [];
      if (userDealbreakers.length === 0) return feedItems;
      return feedItems.filter((item) => {
        for (const dealbreakerId of userDealbreakers) {
          const userResponse = user?.questionnaireResponses?.find(
            (r) => r.issueId === dealbreakerId
          );
          if (!userResponse) continue;
          const candidatePosition = item.candidatePositions.find(
            (cp) => cp.issueId === dealbreakerId
          );
          if (!candidatePosition) continue;
          const userValue = Number(userResponse.answer);
          const candidateValue = candidatePosition.spectrumPosition;
          if ((userValue >= 0 && candidateValue < 0) ||
              (userValue < 0 && candidateValue >= 0)) {
            return false;
          }
        }
        return true;
      });
    }

    case 'location':
      if (!selectedLocation) return feedItems;
      return feedItems.filter((item) =>
        item.candidate.district === selectedLocation ||
        item.candidate.zone === selectedLocation
      );

    case 'random':
    default: {
      const shuffled = [...feedItems];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    }
  }
}, [feedItems, experienceFilter, selectedLocation, user]);
```

### Add new state and imports to for-you.tsx:

```ts
// New imports:
import LocationMapModal from '@/components/feed/LocationMapModal';
import { ExperienceFilter } from '@/components/feed/ExperienceMenu';
import { selectBrowsingDistrict } from '@/stores';

// Remove the local duplicate type definition (line 22):
// - type ExperienceFilter = 'random' | 'issues' | 'most_important' | 'location';
// + import from ExperienceMenu instead (above)

// New state (add alongside existing state):
const [locationModalVisible, setLocationModalVisible] = useState(false);
const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
const selectedDistrict = useUserStore(selectBrowsingDistrict);

// Update ExperienceMenu to add onLocationPress:
<ExperienceMenu
  selectedFilter={experienceFilter}
  onFilterChange={setExperienceFilter}
  onLocationPress={() => setLocationModalVisible(true)}
  style={{ top: insets.top + 8 }}
/>

// Add LocationMapModal below the FlatList:
<LocationMapModal
  visible={locationModalVisible}
  onDismiss={() => setLocationModalVisible(false)}
  onLocationSelect={(zoneId) => {
    setSelectedLocation(zoneId);
    setExperienceFilter('location');
  }}
  district={selectedDistrict}
/>
```

---

## Step 5: Export New Component

**File:** `src/components/feed/index.ts`

Add export for LocationMapModal (ExperienceMenu already exported):

```ts
export { default as LocationMapModal } from './LocationMapModal';
```

---

## Progressive Filter Gating (Aligned with Plan 01)

Filter availability is determined by the user's onboarding state, using Plan 01's capability selectors. The ExperienceMenu reads these directly from the store — no prop drilling needed. Anonymous users can use Random and Location.

| User State | Available Filters | Locked Filters |
| :---- | :---- | :---- |
| Anonymous, no quiz | Random, Location | Issues ("Complete the quiz to unlock"), Most Important ("Complete the quiz and set dealbreakers to unlock") |
| Upgraded account, no quiz | Random, Location | Issues, Most Important |
| Quiz complete (1+ question), no dealbreakers | Random, Location, Issues | Most Important ("Set your dealbreakers to unlock") |
| Quiz + dealbreakers complete | Random, Location, Issues, Most Important | None |

Note: Since all users (including anonymous) have a Firestore document via Firebase Anonymous Auth (Plan 01), `selectCanSeeAlignment` works uniformly — it checks `onboarding.questionnaire === 'complete'` on the Firestore document. No dual-source branching needed.

---

## Mass Endorsement (Already Implemented)

`MassEndorseButton` was **fully implemented in Plan 04** and is already integrated in `for-you.tsx`. No changes needed for Plan 05.

Behavior:
- Appears when non-random filter active, user is fully verified, and endorsable candidates exist
- Filters by district match + not already endorsed
- Shows confirmation dialog before batch endorsement
- Hidden for anonymous/unverified users

---

## Cross-District Viewing

Users can view candidates in any district by toggling the district selector on the home page (`DistrictToggle` component). The Location filter's map modal shows zones for the currently browsed district via `selectBrowsingDistrict`. The endorsement button (both individual and mass) is gated by district membership per Plan 01.

| Action | District Requirement |
| :---- | :---- |
| Browse/view candidates in PA-01 | None (anonymous OK) |
| Browse/view candidates in PA-02 | None (anonymous OK) |
| Endorse candidate in PA-01 | Account + fully verified + `PA-01` in user's districts |
| Endorse candidate in PA-02 | Account + fully verified + `PA-02` in user's districts |
| Mass endorse in PA-01 | Same as individual endorsement |

---

## Implementation Order

1. **Step 1a**: Add `zone?: string` to `CandidatePreview` in `src/types/index.ts` and `src/types/index.web.ts`
2. **Step 1b**: Pass `zone` in `generateFeedItem()` in `app/(tabs)/for-you.tsx`
3. **Step 1c**: Add `district` + `zone` to `seedCandidates()` in `firestore.ts` and `firestore.web.ts`
4. **Step 1d**: Add `district` to `processApplication` Cloud Function
5. **Step 2**: Replace `ExperienceMenu.tsx` stub with full dropdown implementation
6. **Step 3**: Create `LocationMapModal.tsx`
7. **Step 4**: Upgrade filter logic + add location state/modal to `for-you.tsx`
8. **Step 5**: Export `LocationMapModal` from `feed/index.ts`
9. **Re-seed data**: Run the app to re-seed candidates with district/zone data
10. **Verify**: `npx tsc --noEmit`, build, test all 4 filters + location modal

---

## Files Summary

### Files to Create

| File | Purpose |
| :---- | :---- |
| `src/components/feed/LocationMapModal.tsx` | SVG map for PA-01/PA-02 zone selection |

### Files to Modify (Replace)

| File | Change |
| :---- | :---- |
| `src/components/feed/ExperienceMenu.tsx` | **Replace stub** with full dropdown + gating |

### Files to Modify (Edit)

| File | Change |
| :---- | :---- |
| `src/types/index.ts` | Add `zone?: string` to `CandidatePreview` |
| `src/types/index.web.ts` | Add `zone?: string` to `CandidatePreview` |
| `app/(tabs)/for-you.tsx` | Add `zone` to generateFeedItem, upgrade filter logic, add location state + modal |
| `src/services/firebase/firestore.ts` | Assign district/zone in `seedCandidates()` |
| `src/services/firebase/firestore.web.ts` | Assign district/zone in `seedCandidates()` |
| `functions/src/candidates/processApplication.ts` | Add district to candidate creation |
| `src/components/feed/index.ts` | Export `LocationMapModal` |

### Files Unchanged (Already Done in Plan 04)

| File | Status |
| :---- | :---- |
| `app/_layout.tsx` | subscribeToProfile already wired up |

---

## Implementation Notes (2026-03-05)

### Summary

Plan 05 was implemented with several deviations from the proposed design. All 4 experience filters work correctly, the LocationMapModal displays SVG maps, and the MassEndorseButton shows for filtered results. Key changes from the plan are documented below.

### Deviation 1: Custom Dropdown Instead of Paper Menu

The proposed design used React Native Paper's `<Menu>` component for ExperienceMenu. However, Paper's `<Menu>` renders via `<Portal>`, which mounts at the `<PaperProvider>` root level. This caused the dropdown to **block all touch events on the entire For You page**, including tab bar navigation, because the Portal overlay sits above other content even when the menu is dismissed.

**Actual implementation:** A custom dropdown using `<View>` + `<Pressable>` from react-native. The dropdown renders inline (no Portal) with an absolutely-positioned backdrop for dismiss handling. This avoids all Portal touch-interception issues.

### Deviation 2: MassEndorseButton — Infinite Re-render Fix

The plan stated MassEndorseButton was "fully implemented, no changes needed." In practice, it caused an **infinite re-render loop that froze the entire iOS simulator**, requiring a force quit.

**Root cause:** `selectUserDistrictIds` in `userStore.ts` returns `state.userProfile?.districts?.map((d) => d.id) || []`. The `.map()` creates a **new array reference** on every Zustand store update, which triggers a re-render, which triggers another store read, creating an infinite loop.

**Fix:** Replaced `useUserStore(selectUserDistrictIds)` with:
```tsx
const districts = useUserStore((s) => s.userProfile?.districts);
const userDistrictIds = useMemo(() => districts?.map((d) => d.id) || [], [districts]);
```

This selects the raw (stable) `districts` array and derives IDs locally via `useMemo`, breaking the re-render cycle.

### Deviation 3: Conditional Portal Rendering

All components using React Native Paper's Portal/Modal (`EndorseLockModal` in FullScreenPSA, `ConfirmModal` in MassEndorseButton, `LocationMapModal` in for-you.tsx) are now **conditionally rendered** — they only mount when their visibility state is true.

```tsx
// Instead of always-mounted:
<EndorseLockModal visible={showLockModal} ... />

// Conditionally mounted:
{showLockModal && <EndorseLockModal visible={showLockModal} ... />}
```

This prevents Portal components from intercepting touches when they're not visible.

### Deviation 4: Stable useEffect/useMemo Dependencies

The plan's `for-you.tsx` code used `user` and `issues` objects as useEffect dependencies. These cause unnecessary re-renders because object references change on every store update.

**Actual implementation:**
- `useEffect` depends on `issuesReady` (boolean) and `userId` (string) instead of `issues` and `user` objects
- Filter `useMemo` depends on `userResponses` and `userDealbreakers` (specific user properties) instead of entire `user` object
- `random` filter returns `feedItems` directly (no shuffle) to avoid creating new array references in useMemo

### Deviation 5: Auto-Reseed Migration for Zone Data

Existing seed data from Plan 04 lacked `zone` fields. Instead of requiring manual re-seeding, `for-you.tsx` detects this and auto-reseeds:

```tsx
if (candidatesData.length === 0 ||
    candidatesData.some(({ candidate }) => !candidate.zone)) {
  await reseedAllData();
  candidatesData = await getCandidatesForFeed();
}
```

### Bug Investigation Process

The touch-blocking issue required extensive binary-search debugging:
1. Stripped for-you.tsx to minimal test (buttons worked)
2. Added components back one at a time (all worked individually)
3. Full version with all features broke all touches + caused system hang
4. Isolated MassEndorseButton as the culprit via component removal
5. System hang clue pointed to infinite re-render (not Portal blocking)
6. Traced to `selectUserDistrictIds` creating unstable array references

The Portal touch-blocking (EndorseLockModal/ConfirmModal) was a separate but concurrent issue that was fixed with conditional rendering.
