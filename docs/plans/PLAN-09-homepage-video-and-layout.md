# PLAN: Homepage Video Window and Section Reorder

> **Related:** [PLAN-00: Contest Round Architecture](./PLAN-00-contest-round-architecture.md) — the "About the Contest" section in the new homepage order uses the contest round timeline from PLAN-00/PLAN-16.

## Summary

- Remove the black overlay line and "Learn how our..." subtitle text from the video window  
- Make the video window smaller  
- Reorder homepage sections: Video → Quiz → Apply Filters → Character Search → Verify Identity → Submit Endorsements → About the Contest → FAQs

## Current State

File: `src/components/home/VoterHome.tsx`

Current video section (lines 73-94):

```
<Card style={styles.videoCard}>
  <View style={styles.videoContainer}>
    <View style={[styles.videoPlaceholder, ...]}>
      <MaterialCommunityIcons name="play-circle-outline" size={64} ... />
      <Text variant="bodyMedium" ...>Welcome Video</Text>  {/* REMOVE */}
    </View>
  </View>
  <View style={styles.videoInfo}>
    <Text variant="titleMedium">Welcome to {partyName}</Text>
    <Text variant="bodyMedium">Learn how our democratic nomination process works</Text>  {/* REMOVE */}
  </View>
</Card>
```

Current section order:

1. Welcome Video  
2. Quick Actions (Browse Candidates, View Leaderboard)  
3. Resources (Register to Vote, Policy Preferences, Election Calendar)  
4. FAQs  
5. Run for Office CTA

## Files to Modify

- `src/components/home/VoterHome.tsx` — video changes \+ section reorder \+ new sections

## Implementation Details

### 1\. Simplify video card

Remove the subtitle text "Learn how our..." and the "Welcome Video" placeholder label. Make the video container smaller by reducing the aspect ratio:

```
{/* Welcome Video Section — simplified and smaller */}
<Card style={styles.videoCard}>
  <View style={styles.videoContainer}>
    <View style={[styles.videoPlaceholder, { backgroundColor: theme.colors.surfaceVariant }]}>
      <MaterialCommunityIcons
        name="play-circle-outline"
        size={48}
        color={theme.colors.primary}
      />
    </View>
  </View>
</Card>
```

Update style:

```ts
videoContainer: {
  aspectRatio: 2,  // was 16/9 (1.78), now wider/shorter
  width: '100%',
},
```

### 2\. Add new compact section components

**Policy Quiz section:**

```
{/* Policy Quiz */}
<Card style={styles.sectionCard} onPress={() => router.push('/settings/issues')}>
  <View style={styles.compactRow}>
    <MaterialCommunityIcons name="clipboard-list" size={28} color={theme.colors.primary} />
    <View style={styles.compactText}>
      <Text variant="titleMedium" style={{ fontWeight: '600' }}>
        {hasCompletedQuiz ? 'Change the Quiz' : 'Take the Quiz'}
      </Text>
    </View>
    <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.outline} />
  </View>
</Card>
```

**Apply Filters section (compact):**
This filter is **not connected to the user’s quiz answers**. Instead, it opens a standalone policy filter screen where the user can select from all existing policy options and see all candidates who hold that position.

```
<Card style={styles.sectionCard} onPress={() => router.push(‘/(tabs)/for-you?openFilter=true’)}>
  <View style={styles.compactRow}>
    <MaterialCommunityIcons name="filter" size={28} color={theme.colors.secondary} />
    <View style={styles.compactText}>
      <Text variant="titleMedium" style={{ fontWeight: ‘600’ }}>Filter by Policy</Text>
      <Text variant="bodySmall" style={{ color: theme.colors.outline }}>browse all policy positions</Text>
    </View>
    <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.outline} />
  </View>
</Card>
```

**Important:** The filter should display all available policy options (from all issues in the system), regardless of which issues the user selected during the quiz. When the user selects a policy position, the app navigates to a filtered view showing all candidates who hold that position. This is independent of the quiz and alignment scoring.

**Character Search section (compact):**

```
<Card style={styles.sectionCard} onPress={() => router.push('/(tabs)/for-you')}>
  <View style={styles.compactRow}>
    <MaterialCommunityIcons name="account-search" size={28} color={theme.colors.secondary} />
    <View style={styles.compactText}>
      <Text variant="titleMedium" style={{ fontWeight: '600' }}>Search</Text>
      <Text variant="bodySmall" style={{ color: theme.colors.outline }}>by name & location</Text>
    </View>
    <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.outline} />
  </View>
</Card>
```

**Verify Identity section (compact):**

```
<Card style={styles.sectionCard} onPress={() => router.push('/(auth)/verify-identity')}>
  <View style={styles.compactRow}>
    <MaterialCommunityIcons name="shield-check" size={28} color={theme.colors.tertiary} />
    <View style={styles.compactText}>
      <Text variant="titleMedium" style={{ fontWeight: '600' }}>Verify Identity</Text>
      <Text variant="bodySmall" style={{ color: theme.colors.outline }}>learn how this works</Text>
    </View>
    <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.outline} />
  </View>
</Card>
```

**Submit Endorsements section (compact, grey when no bookmarks):**

```
<Card
  style={[styles.sectionCard, endorsements.length === 0 && styles.disabledCard]}
  onPress={endorsements.length > 0 ? handleSubmitEndorsements : undefined}
>
  <View style={styles.compactRow}>
    <MaterialCommunityIcons
      name="thumb-up"
      size={28}
      color={endorsements.length > 0 ? theme.colors.primary : theme.colors.outline}
    />
    <View style={styles.compactText}>
      <Text variant="titleMedium" style={{
        fontWeight: '600',
        color: endorsements.length > 0 ? theme.colors.onSurface : theme.colors.outline,
      }}>
        Submit Endorsements
      </Text>
      <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
        learn how this works
      </Text>
    </View>
    <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.outline} />
  </View>
</Card>
```

### 3\. New section order in render

```
return (
  <View style={styles.container}>
    {/* 1. Welcome Video (smaller, no subtitle) */}
    {/* 2. Policy Quiz */}
    {/* 3. Apply Filters */}
    {/* 4. Character Search */}
    {/* 5. Verify Identity */}
    {/* 6. Submit Endorsements (grey if no bookmarks) */}
    {/* 7. About the Contest (updated content) */}
    {/* 8. FAQs */}
  </View>
);
```

### 4\. Add compact row styles

```ts
sectionCard: {
  marginBottom: 12,
},
compactRow: {
  flexDirection: 'row',
  alignItems: 'center',
  padding: 16,
},
compactText: {
  flex: 1,
  marginLeft: 16,
},
disabledCard: {
  opacity: 0.5,
},
```

## Testing

- Video window is visibly smaller with no text overlay  
- All sections render in correct order  
- Submit Endorsements is grey when user has no endorsements bookmarked  
- Each section navigates to the correct screen on press  
- Quiz label toggles between "Take the Quiz" and "Change the Quiz"

