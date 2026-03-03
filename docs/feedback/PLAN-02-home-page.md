# Plan 02: Home Page Redesign

**Feedback:** Redesign top bar (logo left, remove tagline, add district toggle), replace content sections with ordered list (Video, Quiz, Character Search, Verify ID, Calendar, Submit/Endorse, About, FAQs).

---

## Current State

### Top Bar (`app/(tabs)/index.tsx`)
- AMSP logo centered (160×44px)
- Tagline below: "Your voice matters" (from `partyConfig.tagline`)
- No district selector

### Content (`src/components/home/VoterHome.tsx`)
1. Welcome Video card (placeholder)
2. Quick Actions (Browse Candidates, View Leaderboard buttons)
3. Resources (Register to Vote, Policy Preferences, Election Calendar)
4. FAQ accordion (4 items)
5. Run for Office CTA card

---

## Proposed Changes

### A. Top Bar Redesign

**File: `app/(tabs)/index.tsx`**

Replace the current centered header with a new layout:

```
┌─────────────────────────────────────────────┐
│ [AMSP Logo]              [PA-01 ▼]          │
│  (left-aligned)          (district toggle)  │
└─────────────────────────────────────────────┘
```

**Current header code:**
```tsx
<View style={styles.header}>
  <Image source={require('../../assets/amsp-logo.png')} style={styles.logo} />
  <Text variant="bodySmall" style={styles.tagline}>
    {partyConfig?.tagline || 'Your voice matters'}
  </Text>
</View>
```

**New header code:**
```tsx
<View style={styles.header}>
  <View style={styles.headerLeft}>
    <Image source={require('../../assets/amsp-logo.png')} style={styles.logo} />
  </View>
  <View style={styles.headerRight}>
    <DistrictToggle
      selectedDistrict={selectedDistrict}
      onDistrictChange={setSelectedDistrict}
    />
  </View>
</View>
```

**New header styles:**
```typescript
header: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingHorizontal: 16,
  paddingTop: 8,
  paddingBottom: 8,
},
headerLeft: {
  flexDirection: 'row',
  alignItems: 'center',
},
headerRight: {
  flexDirection: 'row',
  alignItems: 'center',
},
```

### B. District Toggle Component

**New file: `src/components/home/DistrictToggle.tsx`**

A dropdown/toggle that switches between PA-01 and PA-02. This will be a small chip-style selector:

```tsx
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Menu, Button, Text, useTheme } from 'react-native-paper';

interface DistrictToggleProps {
  selectedDistrict: string;
  onDistrictChange: (district: string) => void;
}

const DISTRICTS = [
  { id: 'PA-01', label: 'PA-01', state: 'PA', number: '01' },
  { id: 'PA-02', label: 'PA-02', state: 'PA', number: '02' },
];

export default function DistrictToggle({
  selectedDistrict,
  onDistrictChange,
}: DistrictToggleProps) {
  const [menuVisible, setMenuVisible] = useState(false);
  const theme = useTheme();

  return (
    <Menu
      visible={menuVisible}
      onDismiss={() => setMenuVisible(false)}
      anchor={
        <Button
          mode="outlined"
          compact
          onPress={() => setMenuVisible(true)}
          icon="map-marker"
          contentStyle={styles.buttonContent}
          labelStyle={styles.buttonLabel}
        >
          {selectedDistrict}
        </Button>
      }
    >
      {DISTRICTS.map((district) => (
        <Menu.Item
          key={district.id}
          onPress={() => {
            onDistrictChange(district.id);
            setMenuVisible(false);
          }}
          title={district.label}
          leadingIcon={
            selectedDistrict === district.id ? 'check' : undefined
          }
        />
      ))}
    </Menu>
  );
}

const styles = StyleSheet.create({
  buttonContent: { height: 32 },
  buttonLabel: { fontSize: 13, marginHorizontal: 8 },
});
```

### C. District State Management

**File: `src/stores/userStore.ts` — add district to user state**

```typescript
// Add to UserState
selectedDistrict: string; // 'PA-01' | 'PA-02'

// Add action
setSelectedDistrict: (district: string) => void;

// Implementation
setSelectedDistrict: (district) => {
  set({ selectedDistrict: district });
  // Persist to Firestore user document
  const userId = get().userProfile?.id;
  if (userId) {
    updateUser(userId, { district });
  }
},
```

The selected district value will be read by:
- Home page (to show district-specific content)
- Quiz page (to load district-specific questions)
- For You page (to filter candidates by district)

### D. Home Page Content Redesign

**File: `src/components/home/VoterHome.tsx` — complete rewrite of content sections**

Replace all current content with the ordered list from feedback. Each item is a pressable card:

```tsx
export default function VoterHome() {
  const router = useRouter();
  const theme = useTheme();
  const { partyConfig } = useConfigStore();
  const user = useUserStore((s) => s.userProfile);

  // Track which quiz issues the user has completed
  const completedIssueCount = user?.questionnaireResponses?.length || 0;
  const totalIssues = 7;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* 1. Video - A Brand New Way */}
      <VideoCard />

      {/* 2. Quiz - 7 Issues Graphic */}
      <QuizCard
        completedCount={completedIssueCount}
        totalCount={totalIssues}
        onPress={() => router.push('/(auth)/onboarding/issues')}
      />

      {/* 3. Character Search */}
      <ContentCard
        icon="account-search"
        title="Character Search"
        subtitle="Find candidates by name or policy position"
        onPress={() => router.push('/(tabs)/for-you')}
      />

      {/* 4. Verify ID */}
      <ContentCard
        icon="shield-check"
        title="Verify Your Identity"
        subtitle="Verify to unlock endorsement and voting features"
        onPress={() => router.push('/(auth)/verify-identity')}
        completed={user?.verificationStatus === 'verified'}
      />

      {/* 5. Calendar */}
      <NominationCalendar />

      {/* 6. Submit/Endorse */}
      <ContentCard
        icon="thumb-up"
        title="Submit / Endorse"
        subtitle="Endorse your preferred candidates"
        onPress={() => router.push('/(tabs)/for-you')}
      />

      {/* 7. About The Contest */}
      <ContentCard
        icon="information"
        title="About The Contest"
        subtitle="Learn how the AMSP nomination process works"
        onPress={() => { /* open info modal or web link */ }}
      />

      {/* 8. FAQs */}
      <FAQSection />

    </ScrollView>
  );
}
```

### E. Quiz Graphic Card

**New component within VoterHome or extracted to `src/components/home/QuizCard.tsx`**

Shows 7 issue icons in a row/grid with one-word labels. Completed issues are visually distinct (filled color, checkmark). Tapping navigates to the quiz.

```tsx
interface QuizCardProps {
  completedCount: number;
  totalCount: number;
  onPress: () => void;
}

function QuizCard({ completedCount, totalCount, onPress }: QuizCardProps) {
  const theme = useTheme();
  const { issues } = useConfigStore();

  // Show first 7 issues (or the user's selected 7)
  const displayIssues = issues.slice(0, 7);

  return (
    <Pressable onPress={onPress}>
      <Card style={styles.quizCard}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.cardTitle}>
            Policy Quiz
          </Text>
          <Text variant="bodySmall" style={styles.cardSubtitle}>
            {completedCount}/{totalCount} completed
          </Text>
          <View style={styles.issueGrid}>
            {displayIssues.map((issue, index) => {
              const isCompleted = index < completedCount;
              return (
                <View key={issue.id} style={styles.issueItem}>
                  <View
                    style={[
                      styles.issueCircle,
                      isCompleted && {
                        backgroundColor: theme.colors.primary,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={isCompleted ? 'check' : issue.icon}
                      size={20}
                      color={isCompleted ? '#fff' : theme.colors.outline}
                    />
                  </View>
                  <Text
                    variant="labelSmall"
                    numberOfLines={1}
                    style={styles.issueLabel}
                  >
                    {getOneWordLabel(issue.name)}
                  </Text>
                </View>
              );
            })}
          </View>
        </Card.Content>
      </Card>
    </Pressable>
  );
}

// Map issue names to single-word labels
function getOneWordLabel(name: string): string {
  const map: Record<string, string> = {
    'Economy & Jobs': 'Economy',
    'Healthcare': 'Health',
    'Climate Change': 'Climate',
    'Immigration': 'Immigration',
    'Education': 'Education',
    'Gun Policy': 'Guns',
    'Civil Rights': 'Rights',
  };
  return map[name] || name.split(' ')[0];
}
```

### F. Nomination Calendar Component

**New component: `src/components/home/NominationCalendar.tsx`**

Displays the weekly nomination timeline from the feedback document:

```
Sun-Mon     | Tue  | Wed | Thu          | Fri          | Sat
Entire Field| 20   | 10  | 4            | 2            | AMSP
            |      |     | Virtual      | Final        | Nominee
            |      |     | Town Hall    | Debate       |
─────────── Endorsement Round ──────────
```

```tsx
function NominationCalendar() {
  const theme = useTheme();

  const stages = [
    { label: 'Entire Field', span: 2, sub: '' },
    { label: '20', span: 1, sub: '' },
    { label: '10', span: 1, sub: '' },
    { label: '4', span: 1, sub: 'Virtual\nTown Hall' },
    { label: '2', span: 1, sub: 'Final\nDebate' },
    { label: 'AMSP\nNominee', span: 1, sub: '' },
  ];

  return (
    <Card style={styles.calendarCard}>
      <Card.Content>
        <Text variant="titleMedium" style={styles.cardTitle}>
          Nomination Timeline
        </Text>
        <Text variant="bodySmall" style={styles.calendarNote}>
          Each day represents one week of the actual process
        </Text>
        <View style={styles.calendarRow}>
          {stages.map((stage, i) => (
            <View
              key={i}
              style={[
                styles.calendarCell,
                { flex: stage.span },
                i < stages.length - 1 && styles.calendarCellBorder,
              ]}
            >
              <Text variant="labelLarge" style={styles.calendarCount}>
                {stage.label}
              </Text>
              {stage.sub ? (
                <Text variant="labelSmall" style={styles.calendarSub}>
                  {stage.sub}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
        <View style={styles.endorsementBar}>
          <Text variant="labelSmall" style={styles.endorsementText}>
            Endorsement Round
          </Text>
        </View>
      </Card.Content>
    </Card>
  );
}
```

### G. Bottom Tab Bar — No Changes Needed

The current tab bar already matches the feedback:
- Home
- For You
- Leaderboard
- Profile

No changes required to `app/(tabs)/_layout.tsx`.

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/home/DistrictToggle.tsx` | PA-01/PA-02 dropdown selector |
| `src/components/home/QuizCard.tsx` | 7-issue graphic card with completion status |
| `src/components/home/NominationCalendar.tsx` | Weekly nomination timeline |
| `src/components/home/ContentCard.tsx` | Reusable card for Character Search, Verify ID, Submit/Endorse, About |

## Files to Modify

| File | Change |
|------|--------|
| `app/(tabs)/index.tsx` | Replace centered header with left-aligned logo + district toggle |
| `src/components/home/VoterHome.tsx` | Replace all content with 8-item ordered list |
| `src/components/home/index.ts` | Export new components |
| `src/stores/userStore.ts` | Add `selectedDistrict` state + `setSelectedDistrict` action |
| `src/types/index.ts` | Ensure `district` field on User type is used consistently |

---

## District Toggle Behavior

When the user switches district:
1. The home page content updates (future: district-specific video, calendar)
2. The quiz loads district-specific questions (if any differ)
3. The For You feed filters candidates by district
4. The value persists to the user's Firestore document

For the beta with only PA-01 and PA-02, the toggle is a simple two-option dropdown. The architecture supports adding more districts later by extending the `DISTRICTS` array.

---

## Open Questions

1. **Video content** — Is there a "A Brand New Way" video URL to embed, or should this remain a placeholder?
2. **About The Contest** — Should this open an in-app modal, a web link, or a new screen?
3. **Submit/Endorse** — This was noted as "not discussed". Should it route to For You page, or to a separate endorsement management screen?
4. **Calendar interactivity** — Is the calendar purely informational, or should stages be tappable for details?
