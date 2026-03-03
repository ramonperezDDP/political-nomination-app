# Plan 05: Experience Filters & Location Maps

**Feedback:** Experience dropdown menu with 4 filters: Issues, Location (with PA-01/PA-02 maps), Random, Most Important Issues. Replace "High Alignment" with "Random".

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

**Filter gating uses Plan 01's capability selectors** — each filter option has independent requirements based on the user's verification/onboarding state:

| Filter | Required State | Plan 01 Selector |
|--------|---------------|-----------------|
| Random | Email verified | `selectCanBrowse` |
| Location | Email verified | `selectCanBrowse` |
| Issues | Questionnaire complete (3+ questions) | `selectCanSeeAlignment` |
| Most Important | Questionnaire complete AND Dealbreakers complete | `selectCanSeeAlignment` AND `selectCanSeeDealbreakers` |

```
┌──────────────────────────────────────────┐
│                              [Issues ▼]  │
│                                          │
│   (Dropdown opens:)                      │
│   ┌────────────────────────┐             │
│   │ ● Issues               │             │
│   │ ○ Most Important       │             │
│   │ ○ Location             │             │
│   │ ○ Random               │             │
│   └────────────────────────┘             │
│                                          │
│        [ FULL SCREEN PSA ]               │
│                                          │
└──────────────────────────────────────────┘
```

---

## New Component: `src/components/feed/ExperienceMenu.tsx`

```tsx
import React, { useState } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Menu, Button, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useUserStore, selectCanSeeAlignment, selectCanSeeDealbreakers } from '@/stores';

export type ExperienceFilter = 'issues' | 'most_important' | 'location' | 'random';

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
  {
    id: 'location',
    label: 'Location',
    icon: 'map-marker',
    description: 'PNs from a specific area',
    disabledDescription: '', // Never disabled
  },
  {
    id: 'random',
    label: 'Random',
    icon: 'shuffle-variant',
    description: 'All PSAs in random order',
    disabledDescription: '', // Never disabled
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
        return !canSeeAlignment;       // Requires questionnaire = complete
      case 'most_important':
        return !canSeeAlignment || !canSeeDealbreakers; // Requires both
      case 'location':
      case 'random':
        return false;                   // Always available (email gate is at tab level)
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
Show only PNs that have answered quiz questions the same way as the user. A PN needs **at least one** shared policy position to appear.

```typescript
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
**Excludes** PNs who oppose the user on dealbreaker issues (aligned with Plan 03's `applyMustMatchFilter`). This is a **subtractive** filter — candidates are only removed if they actively oppose the user on a dealbreaker. Candidates with no position on a dealbreaker issue are kept (benefit of the doubt).

```typescript
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
      if (!candidatePosition) continue; // Candidate has no position = keep (not excluded)

      const userValue = Number(userResponse.answer);
      const candidateValue = candidatePosition.spectrumPosition;
      const oppositeDirection =
        (userValue >= 0 && candidateValue < 0) ||
        (userValue < 0 && candidateValue >= 0);

      if (oppositeDirection) return false; // Eliminated — opposes user on dealbreaker
    }
    return true; // Passes — no dealbreaker conflicts
  });
```

### Random Filter
Show all PSAs in random shuffled order. No policy-based filtering.

```typescript
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
Show only PNs from a specific virtual polling location selected via the map modal.

```typescript
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

When the user selects "Location" from the experience menu, a modal opens showing a map of PA-01 or PA-02 with virtual polling locations.

### Approach: SVG-based static maps

Since we only need PA-01 and PA-02 for the beta, use pre-built SVG maps with tappable zones. This avoids adding a heavy map dependency (react-native-maps, mapbox, etc.).

```tsx
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

The SVG paths above are simplified placeholders. For production, we'd need accurate boundary data for PA-01 and PA-02 congressional districts. Options:

1. **GeoJSON → SVG conversion:** Download district boundaries from the US Census Bureau, convert to simplified SVG paths using a tool like mapshaper.org
2. **Pre-rendered SVG:** Create clean SVG maps in Figma/Illustrator with labeled zones
3. **react-native-svg only** — no additional map library needed since these are static district maps

### Candidate District/Zone Assignment

For candidates to appear in location-filtered results, they need a `zone` field. This maps to the virtual polling locations within their district.

**File: `src/types/index.ts` — add zone to Candidate type:**
```typescript
interface Candidate {
  // ... existing fields
  district?: string;  // 'PA-01' | 'PA-02'
  zone?: string;      // 'pa01-north' | 'pa01-central' | etc.
}
```

**File: `src/services/firebase/firestore.ts` — assign zones to seeded candidates:**
```typescript
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

The ExperienceMenu reads user state directly via Plan 01's selectors (`selectCanSeeAlignment`, `selectCanSeeDealbreakers`), so the For You page doesn't need to pass `hasCompletedQuiz` as a prop.

```typescript
// In app/(tabs)/for-you.tsx:
import { useUserStore, selectCanSeeAlignment } from '@/stores';

const [locationModalVisible, setLocationModalVisible] = useState(false);
const [selectedLocation, setSelectedLocation] = useState<string | null>(null);

// Default filter depends on quiz completion (Plan 06)
const canSeeAlignment = useUserStore(selectCanSeeAlignment);
const [experienceFilter, setExperienceFilter] = useState<ExperienceFilter>(
  canSeeAlignment ? 'issues' : 'random'
);

// ExperienceMenu handles its own gating via selectors — no hasCompletedQuiz prop needed:
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
  district={user?.district || 'PA-01'}
/>
```

---

## Progressive Filter Gating (Aligned with Plan 01)

Filter availability is determined by the user's onboarding state, using Plan 01's capability selectors. The ExperienceMenu reads these directly from the store — no prop drilling needed.

| User State | Available Filters | Locked Filters |
|------------|-------------------|----------------|
| Email verified only | Random, Location | Issues ("Complete the quiz to unlock"), Most Important ("Complete the quiz and set dealbreakers to unlock") |
| Quiz complete, no dealbreakers | Random, Location, Issues | Most Important ("Set your dealbreakers to unlock") |
| Quiz + dealbreakers complete | Random, Location, Issues, Most Important | None |

```typescript
// In ExperienceMenu, gating uses Plan 01 selectors:
const canSeeAlignment = useUserStore(selectCanSeeAlignment);     // questionnaire = complete
const canSeeDealbreakers = useUserStore(selectCanSeeDealbreakers); // dealbreakers = complete

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

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/feed/ExperienceMenu.tsx` | Dropdown with 4 filter options |
| `src/components/feed/LocationMapModal.tsx` | SVG map for PA-01/PA-02 zone selection |

## Files to Modify

| File | Change |
|------|--------|
| `app/(tabs)/for-you.tsx` | Replace old filter menu with ExperienceMenu, add location modal state |
| `src/types/index.ts` | Add `zone` field to Candidate type |
| `src/services/firebase/firestore.ts` | Assign district/zone when seeding candidates |
| `src/components/feed/index.ts` | Export new components |

---

## Open Questions

1. **Zone granularity:** How many virtual polling locations per district? The examples above use 3-4 zones. Actual boundaries TBD.
2. **Map accuracy:** Do we need geographically accurate district maps, or are simplified zone diagrams acceptable for the beta?
3. **Candidate zone assignment:** In production, how will candidates be assigned to zones — by their address, zip code, or self-selection?
4. **Cross-district viewing:** Should users in PA-01 be able to view PA-02 candidates via the location filter?
