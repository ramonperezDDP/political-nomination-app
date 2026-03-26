# PLAN: Update "About the Contest" Section — CLOSEST TO IMPLEMENTABLE

> **Updated 2026-03-25:** Status reset after branch reset. AboutContestCard exists with a HARDCODED static timeline. Needs conversion to dynamic Firestore-driven timeline. PLAN-00 selectors (`selectContestTimeline`, `selectRoundStatus`) are now available.

> **Depends on:** [PLAN-00: Contest Round Architecture](./PLAN-00-contest-round-architecture.md) — uses `ContestRoundId`, `ContestRound`, `contestRounds` collection, and `selectContestTimeline` / `selectRoundStatus` selectors defined there.

### Review Notes (Mar 25 feedback)

**Plan text uses stale round-state model:** References `isActive` and `isComplete` booleans on round objects, but PLAN-00 explicitly rejected stored booleans. Must use:
- `selectRoundStatus(roundId)` → `'past' | 'current' | 'future'` (derives from `currentRoundId` + `order`)
- `selectContestTimeline` → ordered `ContestRound[]`
- NO `round.isComplete` or `round.isActive` properties

**Data shape gap:** Plan expects admin-editable descriptions on timeline entries, but `ContestRound` only has `label` and `shortLabel`. If richer timeline text is needed, either:
- Add timeline description fields to `ContestRound`
- Or use a presentation map in code (simpler for now)

**Recommendation:** Implementable after small rewrite to use PLAN-00 selectors instead of stored booleans. Closest to ready of all unimplemented plans.

## Summary

Update the About the Contest section with current content. The endorsement round label should only apply to the first three events, not all events. This section is being replaced with a dynamic timeline driven by the `contestRounds` collection and `currentRoundId` from PLAN-00.

The timeline also displays the voting method for each round (approval voting, ranked choice, pick-one) so users understand how each round works and why the process changes as the field narrows.

## Current State

- No explicit "About the Contest" section exists in the current codebase
- The closest equivalent is the external Resources section in `src/components/home/VoterHome.tsx:114-150` with links to Register to Vote, Policy Preferences, and Election Calendar
- The contest stage is tracked in `partyConfig.contestStage` via `configStore.ts`
- Endorsement cutoffs are in `partyConfig.endorsementCutoffs` (will be replaced by per-round config in PLAN-00)

**Key requirement:** The contest round is a **global, shared state** driven by PLAN-00's architecture. All users see the same round at the same time. The About the Contest timeline highlights the current round and marks past rounds as complete. As rounds advance (daily via cron in beta, admin-triggered in production), the timeline updates in real-time.

## Files to Modify

- `src/components/home/VoterHome.tsx` — replace Resources section with About the Contest timeline

## Implementation Details

### 1\. Read round data from Firestore (not hardcoded)

Instead of hardcoding the round list in the component, read it from the `contestRounds` collection via the configStore. This way, round labels, descriptions, and voting methods can be updated in Firestore without a code change.

```tsx
import { useConfigStore, selectContestTimeline } from '@/stores';

// Inside component:
const contestRounds = useConfigStore(selectContestTimeline); // Sorted by order
const currentRoundId = useConfigStore(
  (state) => state.partyConfig?.currentRoundId || 'pre_nomination'
);
```

`selectContestTimeline` is defined in PLAN-00 and returns all `ContestRound` objects sorted by `order`. Each round has `id`, `label`, `shortLabel`, `votingMethod`, `isEndorsementRound`, `isActive`, `isComplete`, `candidatesEntering`, `candidatesAdvancing`.

### 2\. Voting method labels

Map each round's `votingMethod` to a human-readable label and description for the timeline:

```ts
const VOTING_METHOD_LABELS: Record<string, string> = {
  approval: 'Approval Voting',
  ranked_choice: 'Ranked Choice',
  pick_one: 'Pick One',
  none: '',
};

const VOTING_METHOD_DESCRIPTIONS: Record<string, string> = {
  approval: 'Endorse all candidates you support',
  ranked_choice: 'Rank candidates in order of preference',
  pick_one: 'Choose one candidate (50%+ wins)',
  none: '',
};
```

### 3\. Render as a timeline

Replace the current Resources section (lines 114-150) with a dynamic contest overview:

```tsx
{/* About the Contest */}
<Text variant="titleMedium" style={styles.sectionTitle}>
  About the Contest
</Text>
<Card style={styles.contestCard}>
  {contestRounds
    .filter(round => round.id !== 'post_election') // Hide post-election from timeline
    .map((round, index, arr) => {
      const isActive = round.id === currentRoundId;
      const isPast = round.isComplete;

      return (
        <View key={round.id} style={styles.timelineItem}>
          {/* Timeline dot and connecting line */}
          <View style={styles.timelineDot}>
            <MaterialCommunityIcons
              name={isPast ? 'check-circle' : isActive ? 'circle-double' : 'circle-outline'}
              size={24}
              color={
                isActive ? theme.colors.primary
                : isPast ? theme.colors.outline
                : theme.colors.outlineVariant
              }
            />
            {index < arr.length - 1 && (
              <View
                style={[
                  styles.timelineLine,
                  { backgroundColor: isPast ? theme.colors.outline : theme.colors.outlineVariant },
                ]}
              />
            )}
          </View>

          {/* Round content */}
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
              {isActive && <Chip label="Current" variant="success" />}
            </View>

            {/* Candidate count: e.g., "100 → 20" */}
            {round.candidatesEntering && round.candidatesAdvancing && (
              <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                {round.candidatesEntering} candidates → {round.candidatesAdvancing} advance
              </Text>
            )}

            {/* Voting method badge — shows HOW this round works */}
            {round.votingMethod !== 'none' && (
              <View style={styles.votingMethodRow}>
                <Chip
                  label={VOTING_METHOD_LABELS[round.votingMethod]}
                  variant={round.isEndorsementRound ? 'info' : 'warning'}
                />
                <Text variant="labelSmall" style={{ color: theme.colors.outline, marginLeft: 8 }}>
                  {VOTING_METHOD_DESCRIPTIONS[round.votingMethod]}
                </Text>
              </View>
            )}
          </View>
        </View>
      );
    })}
</Card>
```

### 4\. Styles

```ts
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
votingMethodRow: {
  flexDirection: 'row',
  alignItems: 'center',
  marginTop: 4,
},
```

### Key details

- The "Endorsement" voting method badge (`variant: 'info'`) appears on the first three rounds where `isEndorsementRound: true`. The Virtual Town Hall and Debate rounds show their own voting method badges (`variant: 'warning'` to visually distinguish them).
- Round data comes from Firestore, not hardcoded constants. This means the admin can adjust round labels, candidate counts, or descriptions without a code deploy.
- The `isComplete` and `isActive` fields on each `ContestRound` document (set by the cron or admin transition function from PLAN-00) drive the past/current/future visual treatment.
- Voting method labels prepare users for the UI change in later rounds — even before ranked-choice or pick-one voting is implemented (Phase 3 of PLAN-00), users can see what's coming.

## Testing

- Contest timeline renders with all 7 display rounds (pre_nomination through final_results, post_election hidden)
- "Approval Voting" badge appears on endorsement rounds 1-3
- "Ranked Choice" badge appears on Virtual Town Hall
- "Pick One" badge appears on Debate
- Current round is highlighted in primary color with "Current" chip
- Past rounds show filled checkmark icons
- Future rounds show outline icons in muted color
- Candidate count ("100 → 20") displayed for rounds with entering/advancing counts
- Timeline lines connect the rounds visually
- Changing `currentRoundId` in Firestore updates the timeline in real-time
- Round data loads from `contestRounds` collection (not hardcoded)
