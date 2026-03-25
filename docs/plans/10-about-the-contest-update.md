# PLAN: Update "About the Contest" Section

## Summary
Update the About the Contest section with current content. The endorsement round label should only apply to the first three events, not all events. This section is being replaced with updated content driven by the current contest round.

## Current State
- No explicit "About the Contest" section exists in the current codebase
- The closest equivalent is the external Resources section in `src/components/home/VoterHome.tsx:114-150` with links to Register to Vote, Policy Preferences, and Election Calendar
- The contest stage is tracked in `partyConfig.contestStage` via `configStore.ts`
- Endorsement cutoffs are in `partyConfig.endorsementCutoffs`

## Files to Modify
- `src/components/home/VoterHome.tsx` — replace Resources section with About the Contest

## Implementation Details

### 1. Create About the Contest section in VoterHome

Replace the current Resources section (lines 114-150) with a dynamic contest overview:

```tsx
import { selectContestStage } from '@/stores';

// Inside component:
const contestStage = useConfigStore(selectContestStage);

// Contest timeline data
const contestRounds = [
  {
    id: 'endorsement',
    label: 'Endorsement Round',
    description: 'Endorse candidates using approval voting',
    icon: 'thumb-up',
    isEndorsementRound: true,
  },
  {
    id: 'second_round',
    label: 'Second Round',
    description: 'Field narrowed to top 20 candidates',
    icon: 'filter',
    isEndorsementRound: true,
  },
  {
    id: 'third_round',
    label: 'Third Round',
    description: 'Field narrowed to top 10 candidates',
    icon: 'filter-variant',
    isEndorsementRound: true,
  },
  {
    id: 'virtual_town_hall',
    label: 'Virtual Town Hall',
    description: 'Top 4 candidates answer community questions',
    icon: 'video',
    isEndorsementRound: false,
  },
  {
    id: 'debate',
    label: 'Debate',
    description: 'Final 2 candidates debate live',
    icon: 'microphone',
    isEndorsementRound: false,
  },
  {
    id: 'final_results',
    label: 'Final Results',
    description: 'Party nominee selected with 50%+ support',
    icon: 'trophy',
    isEndorsementRound: false,
  },
];
```

Render as a timeline:

```tsx
{/* About the Contest */}
<Text variant="titleMedium" style={styles.sectionTitle}>
  About the Contest
</Text>
<Card style={styles.contestCard}>
  {contestRounds.map((round, index) => {
    const isActive = round.id === contestStage;
    const isPast = index < contestRounds.findIndex(r => r.id === contestStage);

    return (
      <View key={round.id} style={styles.timelineItem}>
        <View style={styles.timelineDot}>
          <MaterialCommunityIcons
            name={isPast ? 'check-circle' : round.icon}
            size={24}
            color={
              isActive ? theme.colors.primary
              : isPast ? theme.colors.outline
              : theme.colors.outlineVariant
            }
          />
          {index < contestRounds.length - 1 && (
            <View
              style={[
                styles.timelineLine,
                { backgroundColor: isPast ? theme.colors.outline : theme.colors.outlineVariant },
              ]}
            />
          )}
        </View>
        <View style={styles.timelineContent}>
          <View style={styles.timelineLabelRow}>
            <Text
              variant="titleSmall"
              style={{
                fontWeight: isActive ? 'bold' : '500',
                color: isActive ? theme.colors.primary : theme.colors.onSurface,
              }}
            >
              {round.label}
            </Text>
            {round.isEndorsementRound && (
              <Chip label="Endorsement" variant="info" />
            )}
            {isActive && (
              <Chip label="Current" variant="success" />
            )}
          </View>
          <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
            {round.description}
          </Text>
        </View>
      </View>
    );
  })}
</Card>
```

### 2. New styles

```typescript
contestCard: {
  marginBottom: 24,
  padding: 16,
},
timelineItem: {
  flexDirection: 'row',
  marginBottom: 4,
},
timelineDot: {
  alignItems: 'center',
  width: 32,
},
timelineLine: {
  width: 2,
  flex: 1,
  marginVertical: 4,
},
timelineContent: {
  flex: 1,
  marginLeft: 12,
  paddingBottom: 16,
},
timelineLabelRow: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  marginBottom: 4,
},
```

### Key detail from feedback
The "Endorsement" label chip should only appear on the first three rounds (the endorsement rounds), not on Virtual Town Hall, Debate, or Final Results. This is controlled by the `isEndorsementRound: true/false` flag in the data above.

## Testing
- Contest timeline renders with all 6 rounds
- "Endorsement" label only appears on the first 3 rounds
- Current round is highlighted in primary color with "Current" chip
- Past rounds show checkmark icons
- Future rounds show greyed-out icons
- Timeline lines connect the rounds visually
