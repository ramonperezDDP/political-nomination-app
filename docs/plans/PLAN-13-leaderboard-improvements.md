# PLAN: Leaderboard Improvements — 🔴 DO NOT IMPLEMENT YET

> **Updated 2026-03-25:** Status reset after branch reset. Current leaderboard has no issue filter pills, no mass-endorse, and cutoff line logic uses legacy `endorsementCutoffs`.
>
> **Blocked on:** Backend batch endpoint for mass-endorse, finalized filtering model, round-aware endorsement logic (PLAN-00 Phase 2).

> **Depends on:** [PLAN-00: Contest Round Architecture](./PLAN-00-contest-round-architecture.md) — Phase 2 will require round-scoped endorsement counts, candidate elimination filtering, and voting-method-aware display.

### Review Notes (Mar 25 feedback)

**Mass-endorse authorization is too naive:** Plan uses biometric auth as the main gate, but the actual endorsement rules require: upgraded account, email verified, voter registration verified, photo ID verified, AND district match. Local biometrics can be a confirmation layer, but must reuse the exact same eligibility checks (`selectCanEndorseCandidate`) as single-candidate endorsement.

**Client-side sequential endorsement is fragile:** Looping `endorseCandidate()` one-by-one on the client creates partial success, retry confusion, and network fragility. Should be a server-side batch operation (callable Cloud Function) with a single source of truth about what got endorsed.

**Stale elimination references:** Plan uses `isEliminated` but the current architecture uses `contestStatus`. Future-phase section needs rewriting.

**Issue filter source ambiguity:** PLAN-13 copies user-selected issue pills from For You, but PLAN-09 introduced "Apply Filters" on Home as a broader system-wide policy filter. Decide whether leaderboard filtering is based on user's quiz issues, all issues, or both.

**Recommendation:** Fix authorization model for mass-endorse, move to server-side batch, update elimination references to `contestStatus`.

### Review Notes (Mar 25 round 2 feedback)

**Confirmed: do NOT implement yet.** Three hard blockers:

1. **Mass-endorse must be a backend operation.** Client-side `for (...) await endorseCandidate()` will partially succeed, create race conditions, and corrupt state. Needs a callable Cloud Function.

2. **Authorization model must unify under `selectCanEndorseCandidate`.** Currently mixing biometric auth, verification rules, and endorsement eligibility as separate checks. All must flow through the existing eligibility selectors.

3. **Issue filter product decision unresolved:** For You uses quiz-selected issues, PLAN-09 introduced broader policy filters on Home. Leaderboard filtering source needs an explicit decision before implementation.

## Summary

- Remove endorsement threshold line from the Trending leaderboard tab
- Add issue-specific filtering — copy the existing issue filter pill functionality from the For You page (`app/(tabs)/for-you.tsx`) to the leaderboard. The For You page already has horizontal issue pills that filter candidates; replicate this exact pattern.
- Add an “endorse en masse” button — after filtering the leaderboard by issue, the user should be able to mass-endorse all displayed/filtered candidates without clicking through to each one individually. This requires biometric verification.

## Current State

File: `app/(tabs)/leaderboard.tsx`

- Two tabs: Endorsements and Trending (SegmentedButtons, lines 189-205)  
- Endorsement threshold (red cutoff line) renders for ALL entries regardless of tab (lines 64-92)  
- No issue filtering capability on leaderboard  
- No batch endorsement functionality  
- Cutoff line logic at lines 64-68:

```ts
const getCutoffLine = () => {
  const currentCutoff = cutoffs[0]?.threshold || 1000;
  return leaderboard.findIndex((entry) => entry.endorsementCount < currentCutoff);
};
```

## Files to Modify

- `app/(tabs)/leaderboard.tsx` — all three changes

## Implementation Details

### 1\. Hide cutoff line on Trending tab

Modify `renderCandidateTile` (line 78\) to only show the cutoff when on endorsements tab:

```
const renderCandidateTile = ({ item, index }: { item: LeaderboardEntry; index: number }) => {
  const isAboveCutoff = cutoffIndex === -1 || index < cutoffIndex;
  const showCutoffLine = index === cutoffIndex && leaderboardType === 'endorsements'; // ADD THIS CHECK

  return (
    <>
      {showCutoffLine && (
        // ... existing cutoff line JSX (lines 84-91)
      )}
      <Pressable ...>
        <Card
          style={
            (!isAboveCutoff && leaderboardType === 'endorsements') // ALREADY CHECKS - good
              ? [styles.candidateTile, styles.belowCutoff]
              : styles.candidateTile
          }
        >
          {/* ... */}
        </Card>
      </Pressable>
    </>
  );
};
```

### 2\. Add issue filter pills (copy from For You page)

The For You page (`app/(tabs)/for-you.tsx`) already has a working horizontal issue pill filter. Copy this pattern to the leaderboard. The For You page implementation:
- Shows the user's selected issues as tappable chips in a horizontal FlatList
- Toggling a chip filters the feed to candidates matching that issue
- Uses `matchedIssues` array from each feed item for filtering

Replicate for the leaderboard:

```
// Add state
const [selectedIssues, setSelectedIssues] = useState<string[]>([]);
const { issues } = useConfigStore();
const { userProfile } = useUserStore();

// Get user's selected issues for pill display
const userIssueIds = userProfile?.selectedIssues || [];
const userIssues = issues.filter(i => userIssueIds.includes(i.id));

const toggleIssue = (issueId: string) => {
  setSelectedIssues(prev =>
    prev.includes(issueId)
      ? prev.filter(id => id !== issueId)
      : [...prev, issueId]
  );
};

// Filter leaderboard by selected issues
const filteredLeaderboard = selectedIssues.length === 0
  ? leaderboard
  : leaderboard.filter(entry =>
      entry.topIssueIds?.some(id => selectedIssues.includes(id))
    );
```

**Data enrichment required:** The current `LeaderboardEntry` type doesn't include `topIssues`. Add:

- `topIssueIds: string[]` to `LeaderboardEntry` in `src/types/index.ts`
- Populate it in `getCandidatesWithUsers()` in `src/services/firebase/firestore.ts` by reading each candidate's `topIssues` field

Add issue pills UI between header and list:

```
{/* Issue Filter Pills */}
{userIssues.length > 0 && (
  <FlatList
    horizontal
    data={userIssues}
    keyExtractor={(item) => item.id}
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={styles.issuePills}
    renderItem={({ item }) => (
      <Pressable
        onPress={() => toggleIssue(item.id)}
        style={[
          styles.issuePill,
          {
            backgroundColor: selectedIssues.includes(item.id)
              ? theme.colors.primary
              : theme.colors.surfaceVariant,
          },
        ]}
      >
        <Text
          variant="labelMedium"
          style={{
            color: selectedIssues.includes(item.id)
              ? theme.colors.onPrimary
              : theme.colors.onSurface,
          }}
        >
          {item.name}
        </Text>
      </Pressable>
    )}
  />
)}
```

### 3\. Add "Endorse All" button with biometric verification

```
import * as LocalAuthentication from 'expo-local-authentication';

// Add state
const [isEndorsingAll, setIsEndorsingAll] = useState(false);
const { endorseCandidate } = useUserStore();
const { user } = useAuthStore();

const handleEndorseAll = async () => {
  // 1. Biometric authentication
  const authResult = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Verify your identity to submit endorsements',
    cancelLabel: 'Cancel',
  });

  if (!authResult.success) return;

  // 2. Endorse all visible candidates above cutoff
  setIsEndorsingAll(true);
  const candidatesToEndorse = filteredLeaderboard.filter((_, index) =>
    cutoffIndex === -1 || index < cutoffIndex
  );

  try {
    for (const entry of candidatesToEndorse) {
      await endorseCandidate(user!.id, entry.candidateId);
    }
    Alert.alert('Success', `Endorsed ${candidatesToEndorse.length} candidates!`);
    fetchLeaderboard();
  } catch (error: any) {
    Alert.alert('Error', error.message);
  } finally {
    setIsEndorsingAll(false);
  }
};
```

Add button at bottom of list:

```
// Below FlatList, add footer:
<View style={styles.endorseAllContainer}>
  <PrimaryButton
    onPress={handleEndorseAll}
    loading={isEndorsingAll}
    icon="thumb-up"
  >
    Endorse All Displayed
  </PrimaryButton>
</View>
```

### 4\. Additional types needed (`src/types/index.ts`)

```ts
// Add to LeaderboardEntry interface:
interface LeaderboardEntry {
  // ... existing fields
  topIssueIds?: string[];  // NEW: for issue filtering
}
```

### 5\. New styles

```ts
issuePills: {
  paddingHorizontal: 16,
  paddingBottom: 8,
  gap: 8,
},
issuePill: {
  paddingHorizontal: 14,
  paddingVertical: 6,
  borderRadius: 16,
},
endorseAllContainer: {
  padding: 16,
  paddingTop: 8,
},
```

## Dependencies

- `expo-local-authentication` — for biometric verification. Check if already installed; if not: `npx expo install expo-local-authentication`

## Future: Round-Aware Leaderboard (PLAN-00 Phase 2)

When PLAN-00 Phase 2 is implemented, the leaderboard will need these additional changes:

**Eliminated candidate filtering:** Candidate queries must exclude eliminated candidates. Add `.where('isEliminated', '==', false)` to all leaderboard queries, or filter client-side using `eliminatedAt === undefined`.

**Round-scoped endorsement counts:** Endorsements will carry a `roundId` field. The leaderboard endorsement count should reflect the **current round's** endorsements, not cumulative. Update `getCandidatesWithUsers()` to count endorsements where `roundId === currentRoundId`.

**Voting method adaptation:** In later rounds (Virtual Town Hall, Debate), the leaderboard may show vote tallies instead of endorsement counts. The `selectVotingMethod` selector from PLAN-00 determines what metric to display:
- `approval` → endorsement count (current behavior)
- `ranked_choice` → average rank position or Borda score
- `pick_one` → vote count and percentage
- `none` → results only (no active voting)

The "Endorse All" button should also be hidden in rounds where the voting method is not `approval`, since batch endorsement doesn't apply to ranked-choice or pick-one voting.

## Testing

- Switch to Trending tab → cutoff line disappears  
- Switch back to Endorsements → cutoff line reappears  
- Issue pills appear if user has selected issues  
- Tapping an issue pill filters the leaderboard  
- "Endorse All" triggers biometric prompt  
- After biometric success, all visible candidates are endorsed  
- Error handling for biometric failure

