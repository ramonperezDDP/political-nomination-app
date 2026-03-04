# Plan 05: Experience Filters & Location Maps

**Feedback:** Experience dropdown menu with 4 filters: Random, Location (with PA-01/PA-02 maps), Issues, Most Important Issues. Anonymous mode — no email or account required to enter the app. Users can apply filters and then mass endorse all candidates remaining after filtering. Simplified SVG maps for the beta. PNs provide their address for zone assignment. Users can view candidates in other districts but cannot endorse outside their own.

---

## Current State

### Filter Menu (`app/(tabs)/for-you.tsx` lines 249-292)

- "All Candidates" — no filter
- "High Alignment (80%+)" — `alignmentScore >= 80`
- "No Dealbreakers" — `!hasDealbreaker`
- "My Community" — placeholder (not implemented)

### No location/map functionality exists anywhere in the codebase.

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

## New Component: `src/components/feed/ExperienceMenu.tsx`

```
import React, { useState } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Menu, Button, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useUserStore, selectCanSeeAlignment, selectCanSeeDealbreakers } from '@/stores';

export type ExperienceFilter = 'random' | 'location' | 'issues' | 'most_important';

interface ExperienceMenuProps {
  selectedFilter: ExperienceFilter;
  onFilterChange: (filter: ExperienceFilter) => void;
  onLocationPress?: () => void; // Opens location modal
  style?: ViewStyle;
}

interface FilterOption {
  id: ExperienceFilter;
  label: string;
  icon: string;
  description: string;
  disabledDescription: string; // Shown when filter is locked
}

const FILTER_OPTIONS: FilterOption[] = [
  {
    id: 'random',
    label: 'Random',
    icon: 'shuffle-variant',
    description: 'All PSAs in random order',
    disabledDescription: '', // Never disabled
  },
  {
    id: 'location',
    label: 'Location',
    icon: 'map-marker',
    description: 'PNs from a specific area',
    disabledDescription: '', // Never disabled
  },
  {
    id: 'issues',
    label: 'Issues',
    icon: 'clipboard-list',
    description: 'PNs matching your policy positions',
    disabledDescription: 'Complete the quiz to unlock',
  },
  {
    id: 'most_important',
    label: 'Most Important',
    icon: 'star',
    description: 'Exclude PNs who oppose your dealbreaker issues',
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
  const theme = useTheme();

  // Use Plan 01 capability selectors for granular gating
  const canSeeAlignment = useUserStore(selectCanSeeAlignment);
  const canSeeDealbreakers = useUserStore(selectCanSeeDealbreakers);

  const selectedOption = FILTER_OPTIONS.find((o) => o.id === selectedFilter);

  const isFilterDisabled = (filterId: ExperienceFilter): boolean => {
    switch (filterId) {
      case 'issues':
        return !canSeeAlignment;       // Requires questionnaire = complete (1+ question)
      case 'most_important':
        return !canSeeAlignment || !canSeeDealbreakers; // Requires both
      case 'location':
      case 'random':
        return false;                   // Always available — no account needed
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

---

## Filter Logic in `app/(tabs)/for-you.tsx`

### Issues Filter

Show only PNs that have answered quiz questions the same way as the user. A PN needs **at least one** shared policy position to appear. Uses quiz responses from Firestore (all users have a Firestore document via Firebase Anonymous Auth, Plan 01).

```ts
case 'issues':
  return feedItems.filter((item) => {
    // PN must share at least one policy position with user
    if (item.matchedIssues.length === 0) return false;

    // Check if PN has at least one answer matching user's answer direction
    const userResponses = user?.questionnaireResponses || [];
    return item.candidatePositions.some((cp) => {
      const userResponse = userResponses.find((r) => r.issueId === cp.issueId);
      if (!userResponse) return false;
      const userValue = Number(userResponse.answer);
      // Same direction = both positive or both negative on spectrum
      return (userValue >= 0 && cp.spectrumPosition >= 0) ||
             (userValue < 0 && cp.spectrumPosition < 0);
    });
  });
```

### Most Important Filter

**Excludes** PNs who oppose the user on dealbreaker issues (aligned with Plan 03's `applyMustMatchFilter`). This is a **subtractive** filter — candidates are only removed if they actively oppose the user on a dealbreaker. Candidates with no position on a dealbreaker issue are kept (benefit of the doubt). Dealbreakers are stored in Firestore and available to all users including anonymous (per Plan 01).

```ts
case 'most_important':
  const userDealbreakers = user?.dealbreakers || [];
  if (userDealbreakers.length === 0) return feedItems; // No dealbreakers = show all

  return feedItems.filter((item) => {
    // Exclude candidates who OPPOSE the user on any dealbreaker issue
    for (const dealbreakerId of userDealbreakers) {
      const userResponse = user?.questionnaireResponses?.find(
        (r) => r.issueId === dealbreakerId
      );
      if (!userResponse) continue; // User hasn't answered this one = skip

      const candidatePosition = item.candidatePositions.find(
        (cp) => cp.issueId === dealbreakerId
      );
      if (!candidatePosition) continue; // Candidate has no position = keep

      const userValue = Number(userResponse.answer);
      const candidateValue = candidatePosition.spectrumPosition;
      const oppositeDirection =
        (userValue >= 0 && candidateValue < 0) ||
        (userValue < 0 && candidateValue >= 0);

      if (oppositeDirection) return false; // Eliminated
    }
    return true;
  });
```

### Random Filter

Show all PSAs in random shuffled order. No policy-based filtering. Available to all users including anonymous.

```ts
case 'random':
  // Shuffle using Fisher-Yates
  const shuffled = [...feedItems];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
```

### Location Filter

Show only PNs from a specific virtual polling location selected via the map modal. Available to all users including anonymous. The modal does not require user location — it lets the user tap on map zones to find candidates.

```ts
case 'location':
  if (!selectedLocation) return feedItems;
  return feedItems.filter((item) => {
    // Match candidate's district/zone to selected location
    return item.candidate.district === selectedLocation
      || item.candidate.zone === selectedLocation;
  });
```

---

## Location Map Modal: `src/components/feed/LocationMapModal.tsx`

When the user selects "Location" from the experience menu, a modal opens showing a simplified SVG map of PA-01 or PA-02 with virtual polling locations. The user taps a zone to filter candidates by that area. No user location is required.

### Approach: SVG-based static maps (simplified for beta)

Since we only need PA-01 and PA-02 for the beta, use pre-built SVG maps with tappable zones. This avoids adding a heavy map dependency (react-native-maps, mapbox, etc.). Production versions can use geographically accurate boundaries.

```
import React, { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Modal, Portal, Text, Button, useTheme } from 'react-native-paper';
import Svg, { Path, G, Text as SvgText } from 'react-native-svg';

interface LocationMapModalProps {
  visible: boolean;
  onDismiss: () => void;
  onLocationSelect: (locationId: string) => void;
  district: string; // 'PA-01' or 'PA-02'
}

// Virtual polling location zones for each district
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
  title: {
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    textAlign: 'center',
    color: '#666',
    marginBottom: 16,
  },
  mapContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 8,
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
});
```

### SVG Map Data

The SVG paths above are simplified placeholders for the beta. For production, district boundaries can be obtained from the US Census Bureau and converted to SVG using mapshaper.org, or clean SVG maps can be created in Figma/Illustrator.

### Candidate District/Zone Assignment

Candidates provide their address during the application process (Plan 01's candidate application). Their address determines both their district and zone assignment.

**File: `src/types/index.ts` — zone already added to Candidate type in Plan 01:**

```ts
interface Candidate {
  // ... existing fields
  district: string;   // 'PA-01' | 'PA-02'
  zone?: string;      // 'pa01-north' | 'pa01-central' | etc.
}
```

**File: `src/services/firebase/firestore.ts` — assign zones to seeded candidates:**

```ts
// When seeding candidates, assign districts and zones
const zones = {
  'PA-01': ['pa01-north', 'pa01-central', 'pa01-south'],
  'PA-02': ['pa02-west', 'pa02-center', 'pa02-northeast', 'pa02-south'],
};

// Randomly assign a zone within the district
candidate.district = selectedDistrict;
candidate.zone = zones[selectedDistrict][Math.floor(Math.random() * zones[selectedDistrict].length)];
```

---

## Integration into For You Page

The ExperienceMenu reads user state directly via Plan 01's selectors (`selectCanSeeAlignment`, `selectCanSeeDealbreakers`), so the For You page doesn't need to pass capability props.

```ts
// In app/(tabs)/for-you.tsx:
import { useUserStore, selectCanSeeAlignment } from '@/stores';

const [locationModalVisible, setLocationModalVisible] = useState(false);
const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
const selectedDistrict = useUserStore((s) => s.selectedBrowsingDistrict) || 'PA-01';

// Default filter depends on quiz completion (Plan 06)
const canSeeAlignment = useUserStore(selectCanSeeAlignment);
const [experienceFilter, setExperienceFilter] = useState<ExperienceFilter>(
  canSeeAlignment ? 'issues' : 'random'
);

// ExperienceMenu handles its own gating via selectors:
<ExperienceMenu
  selectedFilter={experienceFilter}
  onFilterChange={setExperienceFilter}
  onLocationPress={() => setLocationModalVisible(true)}
  style={styles.experienceMenu}
/>

// Location map modal:
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

## Progressive Filter Gating (Aligned with Plan 01)

Filter availability is determined by the user's onboarding state, using Plan 01's capability selectors. The ExperienceMenu reads these directly from the store — no prop drilling needed. Anonymous users can use Random and Location.

| User State | Available Filters | Locked Filters |
| :---- | :---- | :---- |
| Anonymous, no quiz | Random, Location | Issues ("Complete the quiz to unlock"), Most Important ("Complete the quiz and set dealbreakers to unlock") |
| Upgraded account, no quiz | Random, Location | Issues, Most Important |
| Quiz complete (1+ question), no dealbreakers | Random, Location, Issues | Most Important ("Set your dealbreakers to unlock") |
| Quiz + dealbreakers complete | Random, Location, Issues, Most Important | None |

Note: Since all users (including anonymous) have a Firestore document via Firebase Anonymous Auth (Plan 01), `selectCanSeeAlignment` works uniformly — it checks `onboarding.questionnaire === 'complete'` on the Firestore document. No dual-source branching needed.

```ts
// In ExperienceMenu, gating uses Plan 01 selectors:
const canSeeAlignment = useUserStore(selectCanSeeAlignment);     // questionnaire = complete (1+ question)
const canSeeDealbreakers = useUserStore(selectCanSeeDealbreakers); // dealbreakers = complete (available to all users)

const isFilterDisabled = (filterId: ExperienceFilter): boolean => {
  switch (filterId) {
    case 'issues':       return !canSeeAlignment;
    case 'most_important': return !canSeeAlignment || !canSeeDealbreakers;
    default:             return false;
  }
};
```

Locked filters show a lock icon and an explanation of what the user needs to complete.

---

## Mass Endorsement (Plans 02/05)

After applying a filter, a "Mass Endorse" button appears (see Plan 04's `MassEndorseButton` component). This allows users to endorse all candidates remaining after filtering in a single action.

**Requirements for mass endorsement:**
- Account created + fully verified (email + voter reg + photo ID)
- Candidates must be in the user's verified district
- Only endorses candidates the user hasn't already endorsed

**Flow:**
1. User applies a filter (e.g., Issues + Location)
2. "Endorse all X candidates" button appears
3. Confirmation dialog
4. Batch endorsement
5. Success feedback

Anonymous users and unverified users will not see the mass endorse button.

---

## Cross-District Viewing

Users can view candidates in any district by toggling the district selector on the home page (Plan 02). The Location filter's map modal also shows zones for the currently browsed district. However, the endorsement button (both individual and mass) is gated by district membership per Plan 01.

| Action | District Requirement |
| :---- | :---- |
| Browse/view candidates in PA-01 | None (anonymous OK) |
| Browse/view candidates in PA-02 | None (anonymous OK) |
| Endorse candidate in PA-01 | Account + fully verified + `PA-01` in user's districts |
| Endorse candidate in PA-02 | Account + fully verified + `PA-02` in user's districts |
| Mass endorse in PA-01 | Same as individual endorsement |

---

## Files to Create

| File | Purpose |
| :---- | :---- |
| `src/components/feed/ExperienceMenu.tsx` | Dropdown with 4 filter options |
| `src/components/feed/LocationMapModal.tsx` | SVG map for PA-01/PA-02 zone selection |

## Files to Modify

| File | Change |
| :---- | :---- |
| `app/(tabs)/for-you.tsx` | Replace old filter menu with ExperienceMenu, add location modal state |
| `src/services/firebase/firestore.ts` | Assign district/zone when seeding candidates |
| `src/components/feed/index.ts` | Export new components |
