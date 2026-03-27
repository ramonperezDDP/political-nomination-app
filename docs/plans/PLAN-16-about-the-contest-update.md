# PLAN: Update "About the Contest" Section — COMPLETE

> **Completed 2026-03-27.** Dynamic contest timeline implemented and all 10 test items verified.
>
> **Updated 2026-03-25:** Status reset after branch reset. AboutContestCard exists with a HARDCODED static timeline. Needs conversion to dynamic Firestore-driven timeline. PLAN-00 selectors (`selectContestTimeline`, `selectRoundStatus`) are now available.
>
> **Sequence:** Implement after PLAN-17 (app shell). Second in the execution order.

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

### Review Notes (Mar 25 round 2 feedback)

**Confirmed second to implement after PLAN-17.** Two fixes required:

1. **`isActive`/`isComplete` is a hard blocker, not minor:** Must use `selectRoundStatus(roundId)` — the plan's rendering logic needs to be rewritten around `'past' | 'current' | 'future'` states.

2. **Presentation data gap is bigger than flagged:** Need labels, voting method descriptions, AND candidate counts for the timeline. Current `ContestRound` has `label`, `shortLabel`, `votingMethod`, `candidatesEntering`, `candidatesAdvancing` — these cover most needs. For human-readable voting method descriptions, use a **static presentation map in code** (simpler than adding Firestore fields). Example: `{ approval: 'Approval Voting', ranked_choice: 'Ranked Choice', pick_one: 'Pick One' }`.

3. **Real-time stability:** If configStore subscription flickers, timeline will flash incorrect states. Ensure `contestRounds` are fetched once (not subscribed) and only `currentRoundId` updates in real-time.

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
import { useConfigStore, selectContestTimeline, selectCurrentRoundId } from '@/stores';

// Inside component — all hooks at top level (never inside loops):
const contestRounds = useConfigStore(selectContestTimeline); // Sorted by order
const currentRoundId = useConfigStore(selectCurrentRoundId);

// Precompute status map once (not per-item):
const currentOrder = useMemo(
  () => contestRounds.find(r => r.id === currentRoundId)?.order ?? 0,
  [contestRounds, currentRoundId]
);

// Helper used inside .map() — pure function, no hooks:
const getRoundStatus = (round: ContestRound): 'past' | 'current' | 'future' => {
  if (round.order < currentOrder) return 'past';
  if (round.order === currentOrder) return 'current';
  return 'future';
};
```

`selectContestTimeline` is defined in PLAN-00 and returns all `ContestRound` objects sorted by `order`. Each round has `id`, `label`, `shortLabel`, `votingMethod`, `isEndorsementRound`, `candidatesEntering`, `candidatesAdvancing`. Round status (`past`/`current`/`future`) is derived via `selectRoundStatus(roundId)` — there are NO stored `isActive`/`isComplete` fields.

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
    .filter(round => round.id !== 'post_election') // Temporary special case until display whitelist is added
    .map((round, index, arr) => {
      // Uses getRoundStatus() helper defined above — no hooks inside .map()
      const status = getRoundStatus(round);
      const isActive = status === 'current';
      const isPast = status === 'past';

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
            {round.candidatesEntering != null && round.candidatesAdvancing != null && (
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
- **State ownership:** `configStore` owns both round metadata (fetched once on app init via `fetchContestRounds()`) and the `partyConfig` subscription (real-time `currentRoundId` updates). This component is **selector-only** — it reads `selectContestTimeline` and `selectRoundStatus(roundId)`, never fetches directly.
- **Round status derivation:** Always use `selectRoundStatus(roundId)` → `'past' | 'current' | 'future'`. Do NOT derive status inline from `currentOrder` comparisons — that creates duplicate truth sources across screens.
- Voting method labels prepare users for the UI change in later rounds — even before ranked-choice or pick-one voting is implemented (Phase 3 of PLAN-00), users can see what's coming.
- `post_election` is filtered from display. This is a **temporary special case** — must be replaced with a display whitelist (e.g., `round.showInTimeline !== false`) before additional non-display rounds are added.

## Testing

- [x] Contest timeline renders with all 7 display rounds (pre_nomination through final_results, post_election hidden)
- [x] "Approval Voting" badge appears on endorsement rounds 1-3
- [x] "Ranked Choice" badge appears on Virtual Town Hall
- [x] "Pick One" badge appears on Debate
- [x] Current round is highlighted in primary color with "Current" chip
- [x] Past rounds show filled checkmark icons
- [x] Future rounds show outline icons in muted color
- [x] Candidate count ("100 → 20") displayed for rounds with entering/advancing counts
- [x] Timeline lines connect the rounds visually
- [x] Changing `currentRoundId` in Firestore updates the timeline in real-time
- [x] Round data loads from `contestRounds` collection (not hardcoded)

All tests verified 2026-03-27 via automated store-level round cycling through all 7 rounds (pre_nomination through final_results). Each round correctly shows past/current/future status, voting method labels, and candidate counts.

### Post-implementation fix: Zustand selector stability (2026-03-27)

The original `selectContestTimeline` selector created a new array on every call via `[...state.contestRounds].sort(...)`. This caused infinite re-renders of `AboutContestCard` (Zustand's `Object.is` comparison always saw a "change"), which blocked the JS thread from processing touch events on the Home tab.

**Fix:** Sort `contestRounds` once at fetch time in `fetchContestRounds()`, and have the selector return the stable `state.contestRounds` reference directly. This addressed the review note (Mar 25 round 2, item 3) about real-time stability.
