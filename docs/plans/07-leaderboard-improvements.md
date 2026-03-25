# PLAN: Leaderboard Improvements

## Summary
- Remove endorsement threshold line from the Trending leaderboard tab
- Add issue-specific filtering so users can filter by selected issues
- Add an "endorse en masse" button with biometric verification

## Current State
File: `app/(tabs)/leaderboard.tsx`

- Two tabs: Endorsements and Trending (SegmentedButtons, lines 189-205)
- Endorsement threshold (red cutoff line) renders for ALL entries regardless of tab (lines 64-92)
- No issue filtering capability on leaderboard
- No batch endorsement functionality
- Cutoff line logic at lines 64-68:
  ```typescript
  const getCutoffLine = () => {
    const currentCutoff = cutoffs[0]?.threshold || 1000;
    return leaderboard.findIndex((entry) => entry.endorsementCount < currentCutoff);
  };
  ```

## Files to Modify
- `app/(tabs)/leaderboard.tsx` — all three changes

## Implementation Details

### 1. Hide cutoff line on Trending tab

Modify `renderCandidateTile` (line 78) to only show the cutoff when on endorsements tab:

```tsx
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

### 2. Add issue filter pills

Add state and UI for issue filtering above the leaderboard list:

```tsx
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
  : leaderboard.filter(entry => {
      // entry needs candidate topIssues - may need to enrich data
      return true; // Placeholder - see note below
    });
```

**Note:** The current `LeaderboardEntry` type doesn't include `topIssues`. We'll need to either:
- Add `topIssueIds: string[]` to `LeaderboardEntry` in `src/types/index.ts`
- Populate it in `getCandidatesWithUsers()` in `src/services/firebase/firestore.ts`

Add issue pills UI between header and list:

```tsx
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

### 3. Add "Endorse All" button with biometric verification

```tsx
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

```tsx
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

### 4. Additional types needed (`src/types/index.ts`)

```typescript
// Add to LeaderboardEntry interface:
interface LeaderboardEntry {
  // ... existing fields
  topIssueIds?: string[];  // NEW: for issue filtering
}
```

### 5. New styles

```typescript
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

## Testing
- Switch to Trending tab → cutoff line disappears
- Switch back to Endorsements → cutoff line reappears
- Issue pills appear if user has selected issues
- Tapping an issue pill filters the leaderboard
- "Endorse All" triggers biometric prompt
- After biometric success, all visible candidates are endorsed
- Error handling for biometric failure
