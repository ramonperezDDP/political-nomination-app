# Plan 02: Home Page Redesign — ✅ COMPLETE

> **Completed 2026-03-27.** All sections implemented: AppHeader with logo + district toggle, VideoCard (Vimeo embed), QuizCard (7 issues), ContentCards (Character Search, Verify ID, Submit/Endorse), AboutContestCard (dynamic timeline from Firestore), and FAQs (round-specific). Implementation exceeds plan with dynamic contest timeline and enhanced quiz CTA.

**Feedback:** Redesign top bar (logo left, remove tagline, add district toggle), replace content sections with ordered list (Video, Quiz, Character Search, Verify ID, Submit/Endorse, About The Contest with Calendar, FAQs). Video content will be a Vimeo URL. About section is an in-app explainer that includes the nomination calendar. Submit/Endorse supports mass endorsement after filtering.

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

```
<View style={styles.header}>
  <Image source={require('../../assets/amsp-logo.png')} style={styles.logo} />
  <Text variant="bodySmall" style={styles.tagline}>
    {partyConfig?.tagline || 'Your voice matters'}
  </Text>
</View>
```

**New header code:**

```
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

```ts
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

A dropdown/toggle that switches between PA-01 and PA-02. Available to all users including anonymous — browsing is unrestricted (per Plan 01).

```
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

**File: `src/stores/userStore.ts` — add browsing district to user state**

```ts
// Add to store state
selectedBrowsingDistrict: string; // 'PA-01' | 'PA-02' — for browsing only

// Add action
setSelectedBrowsingDistrict: (district: string) => void;

// Implementation
setSelectedBrowsingDistrict: (district) => {
  set({ selectedBrowsingDistrict: district });
  // Persist for authenticated users only
  const userId = get().userProfile?.id;
  if (userId) {
    updateUser(userId, { lastBrowsingDistrict: district });
  }
},
```

Note: This is a **browsing** district — which district's candidates the user is viewing. It is separate from the user's **verified** districts (which determine endorsement eligibility per Plan 01). Anonymous users can toggle this freely.

The selected browsing district value will be read by:

- Home page (to show district-specific content)
- Quiz page (to load district-specific questions per Plan 03)
- For You page (to filter candidates by district)

### D. Home Page Content Redesign

**File: `src/components/home/VoterHome.tsx` — complete rewrite of content sections**

Replace all current content with the ordered list from feedback. Each item is a pressable card. The calendar is included inside the About section.

```
export default function VoterHome() {
  const router = useRouter();
  const theme = useTheme();
  const { partyConfig } = useConfigStore();
  const user = useUserStore((s) => s.userProfile);
  const hasAccount = useUserStore(selectHasAccount);

  // Track which quiz issues the user has completed (Firestore — all users have a doc via Anonymous Auth)
  const completedIssueCount = user?.questionnaireResponses?.length || 0;
  const totalIssues = 7;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* 1. Video — "A Brand New Way" (Vimeo embed) */}
      <VideoCard videoUrl={partyConfig?.introVideoUrl} />

      {/* 2. Quiz — 7 Issues Graphic */}
      <QuizCard
        completedCount={completedIssueCount}
        totalCount={totalIssues}
        onPress={() => router.push('/quiz')}
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
        subtitle={hasAccount
          ? "Verify to unlock endorsement features"
          : "Create an account and verify to endorse candidates"
        }
        onPress={() => hasAccount
          ? router.push('/(auth)/verify-identity')
          : router.push('/(auth)/register')
        }
        completed={user?.verification?.photoId === 'verified'}
      />

      {/* 5. Submit / Endorse */}
      <ContentCard
        icon="thumb-up"
        title="Submit / Endorse"
        subtitle="Apply filters and endorse matching candidates"
        onPress={() => router.push('/(tabs)/for-you')}
      />

      {/* 6. About The Contest (includes nomination calendar) */}
      <AboutContestCard />

      {/* 7. FAQs */}
      <FAQSection />

    </ScrollView>
  );
}
```

### E. Quiz Graphic Card

**New component: `src/components/home/QuizCard.tsx`**

Shows 7 issue icons in a row/grid with one-word labels. Completed issues are visually distinct (filled color, checkmark). Tapping navigates to the quiz. Works for both anonymous and authenticated users.

```
interface QuizCardProps {
  completedCount: number;
  totalCount: number;
  onPress: () => void;
}

function QuizCard({ completedCount, totalCount, onPress }: QuizCardProps) {
  const theme = useTheme();
  const { issues } = useConfigStore();

  // Show first 7 issues (district-specific)
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

### F. About The Contest Card (with Nomination Calendar)

**New component: `src/components/home/AboutContestCard.tsx`**

An in-app explainer that includes the nomination timeline as a static graphic. Replaces the separate Calendar item.

```
function AboutContestCard() {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);

  const stages = [
    { label: 'Entire Field', span: 2, sub: '' },
    { label: '20', span: 1, sub: '' },
    { label: '10', span: 1, sub: '' },
    { label: '4', span: 1, sub: 'Virtual\nTown Hall' },
    { label: '2', span: 1, sub: 'Final\nDebate' },
    { label: 'AMSP\nNominee', span: 1, sub: '' },
  ];

  return (
    <Card style={styles.aboutCard}>
      <Card.Content>
        <Pressable
          onPress={() => setExpanded(!expanded)}
          style={styles.aboutHeader}
        >
          <MaterialCommunityIcons
            name="information"
            size={24}
            color={theme.colors.primary}
          />
          <Text variant="titleMedium" style={styles.aboutTitle}>
            About The Contest
          </Text>
          <MaterialCommunityIcons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={24}
            color={theme.colors.outline}
          />
        </Pressable>

        {expanded && (
          <View style={styles.aboutContent}>
            <Text variant="bodyMedium" style={styles.aboutText}>
              The AMSP nomination process narrows the field over one week through
              endorsement rounds. Each day represents one week of the actual process.
            </Text>

            {/* Nomination Timeline */}
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

            <Text variant="bodyMedium" style={styles.aboutText}>
              Voters endorse candidates whose positions align with their values.
              Candidates who don't meet the endorsement threshold at each stage
              are eliminated. The final nominee represents the party.
            </Text>
          </View>
        )}
      </Card.Content>
    </Card>
  );
}
```

### G. Mass Endorsement via Submit/Endorse

The "Submit / Endorse" card on the home page routes to the For You page, where users can apply filters (Issues, Most Important, Location) and then mass-endorse all remaining candidates. See Plan 04 and Plan 05 for the mass endorsement button implementation on the For You page.

**Mass endorsement flow:**

1. User taps "Submit / Endorse" on home page → navigates to For You
2. User applies filters (e.g., Issues + Location)
3. A "Mass Endorse" button appears showing count: "Endorse all X candidates"
4. Requires full verification + district match (Plan 01 gating)
5. Confirmation dialog: "Endorse X candidates in [district]?"
6. Batch creates endorsements for all filtered candidates
7. Success toast: "X endorsements submitted"

### H. Bottom Tab Bar — No Changes Needed

The current tab bar already matches the feedback:

- Home
- For You
- Leaderboard
- Profile

No changes required to `app/(tabs)/_layout.tsx`.

---

## Files to Create

| File | Purpose |
| :---- | :---- |
| `src/components/home/DistrictToggle.tsx` | PA-01/PA-02 dropdown selector |
| `src/components/home/QuizCard.tsx` | 7-issue graphic card with completion status |
| `src/components/home/AboutContestCard.tsx` | In-app explainer with nomination timeline |
| `src/components/home/ContentCard.tsx` | Reusable card for Character Search, Verify ID, Submit/Endorse |
| `src/components/home/VideoCard.tsx` | Vimeo video embed card |

## Files to Modify

| File | Change |
| :---- | :---- |
| `app/(tabs)/index.tsx` | Replace centered header with left-aligned logo + district toggle |
| `src/components/home/VoterHome.tsx` | Replace all content with 7-item ordered list |
| `src/components/home/index.ts` | Export new components |
| `src/stores/userStore.ts` | Add `selectedBrowsingDistrict` state + `setSelectedBrowsingDistrict` action |

---

## District Toggle Behavior

When the user switches district:

1. The home page content updates (district-specific video, quiz issues)
2. The quiz loads district-specific questions (Plan 03)
3. The For You feed filters candidates by district
4. The value persists for authenticated users to their Firestore document

For the beta with only PA-01 and PA-02, the toggle is a simple two-option dropdown. The architecture supports adding more districts later by extending the `DISTRICTS` array. Anonymous users can toggle freely — it is stored in local state only.
