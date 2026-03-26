# PLAN: For You Page Improvements — NEEDS BUSINESS-RULE CLARIFICATION

> **Updated 2026-03-25:** Status reset after branch reset. AlignmentExplainerModal does not exist. Share gating and bookmarking system not present. **Needs business-rule decisions before implementation.**

### Review Notes (Mar 25 feedback)

**Bookmark type is under-specified:** The proposed `Bookmark` only has `odid`, `candidateId`, `createdAt`. Not enough in a round-scoped contest system. Must decide:
- Are bookmarks round-specific or portable across rounds?
- Are bookmarks district-specific?
- What happens to bookmarks for eliminated candidates?
- What happens to bookmarks when the user verifies in a different district?

**Alignment explainer and dealbreakers conflict:** The alignment modal source references dealbreaker warnings, while PLAN-10 wants dealbreakers removed. These plans pull in opposite directions.

**Share gating rationale unclear:** Requiring ID verification before sharing is higher friction than the rest of the product model (PLAN-01 gates binding political actions, not discovery/advocacy). Needs explicit product rationale or it will feel arbitrary and hurt organic spread.

**Bookmark persistence:** Plan adds bookmark state to userStore (in-memory), but cross-session persistence and post-verification workflows need a real persisted Firestore model with fetch/subscription strategy.

**Recommendation:** Resolve dealbreaker product decision and bookmark scoping rules before implementation.

> **Depends on:** [PLAN-00: Contest Round Architecture](./PLAN-00-contest-round-architecture.md) — Phase 2 will require hiding eliminated candidates from the feed and scoping endorsements to the current round. Phase 3 will replace the endorse button with round-appropriate voting UI (ranked choice, pick one).

## Summary

- Require ID verification before sharing a candidate
- Reuse the existing alignment percentage explainer from the candidate profile page (`app/candidate/[id].tsx` lines 479-569) as a popup on the For You page — same modal content, triggered by tapping the alignment badge on a candidate card
- Add a **bookmarking** concept: unverified users can tap the endorse button, but instead of endorsing, the candidate is "bookmarked" with a popup explaining the candidate is saved while awaiting identity verification. Bookmarks are visible in a queue. Once verification is complete, the user can "endorse all" bookmarked candidates or select individuals to endorse.

## Current State

- For You screen: `app/(tabs)/for-you.tsx` (488 lines)
- Share button in PSACard is a placeholder with empty `onPress` (`src/components/feed/PSACard.tsx:252-256`)
- Alignment score displayed in `AlignmentBadge` component but no explanatory popup on this page
- Alignment explainer modal already exists on candidate profile page (`app/candidate/[id].tsx:479-569`) — shows overall match %, matched issues, and dealbreaker warnings
- User verification status available via `userProfile?.verificationStatus`
- Endorsement toggle exists on PSACard but is currently locked/hidden for unverified users
- No bookmarking concept exists in the codebase

## Files to Modify

- `src/components/feed/PSACard.tsx` — add verification gate on share, add alignment explainer popup, change endorse button to bookmark for unverified users
- `app/(tabs)/for-you.tsx` — add bookmark queue display
- `src/stores/userStore.ts` — add bookmark state and methods
- `src/types/index.ts` — add Bookmark type
- `app/settings/endorsements.tsx` — add bookmarked candidates section (see PLAN-14)

## Files to Create

- `src/components/feed/AlignmentExplainerModal.tsx` — shared alignment explainer modal (extracted from candidate detail page for reuse)

## Implementation Details

### 1\. Extract alignment explainer into shared component

The alignment explainer modal currently lives in `app/candidate/[id].tsx` (lines 479-569). Extract it into a reusable component so it can be used on both the candidate profile page and the For You feed:

```tsx
// src/components/feed/AlignmentExplainerModal.tsx
import React from 'react';
import { Modal, View, Text, Pressable } from 'react-native';
import { useTheme, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface Props {
  visible: boolean;
  onDismiss: () => void;
  alignmentScore: number;
  matchedIssueNames: string[];
  totalUserIssues: number;
}

export default function AlignmentExplainerModal({
  visible,
  onDismiss,
  alignmentScore,
  matchedIssueNames,
  totalUserIssues,
}: Props) {
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      {/* Same content as app/candidate/[id].tsx lines 479-569 */}
      {/* Overall match %, matched issue count, matched issue chips, explanation */}
    </Modal>
  );
}
```

Use this component in both `app/candidate/[id].tsx` (replacing inline modal) and `src/components/feed/PSACard.tsx`.

### 2\. Add alignment explainer to PSACard

In `src/components/feed/PSACard.tsx`, make the alignment badge tappable to show the same explainer:

```tsx
const [showAlignmentExplainer, setShowAlignmentExplainer] = useState(false);

// Wrap AlignmentBadge in a Pressable:
<Pressable onPress={() => setShowAlignmentExplainer(true)}>
  <AlignmentBadge score={alignmentScore} />
</Pressable>

<AlignmentExplainerModal
  visible={showAlignmentExplainer}
  onDismiss={() => setShowAlignmentExplainer(false)}
  alignmentScore={alignmentScore}
  matchedIssueNames={feedItem.matchedIssueNames}
  totalUserIssues={userProfile?.selectedIssues?.length || 0}
/>
```

### 3\. Gate sharing behind ID verification (`src/components/feed/PSACard.tsx`)

```tsx
const handleShare = async () => {
  if (!isVerified) {
    Alert.alert(
      'Verification Required',
      'You need to verify your identity before sharing candidates. Would you like to verify now?',
      [
        { text: 'Not Now', style: 'cancel' },
        { text: 'Verify', onPress: () => router.push('/(auth)/verify-identity') },
      ]
    );
    return;
  }

  try {
    await Share.share({
      message: `Check out ${feedItem.candidate.displayName} on AMSP!`,
    });
  } catch (error) {
    console.error('Error sharing:', error);
  }
};
```

### 4\. Add bookmarking for unverified users

**Add Bookmark type (`src/types/index.ts`):**

```ts
interface Bookmark {
  id: string;
  odid: string;         // voter ID
  candidateId: string;
  createdAt: Timestamp;
}
```

**Add bookmark state to userStore (`src/stores/userStore.ts`):**

```ts
bookmarks: Bookmark[];
bookmarkCandidate: (odid: string, candidateId: string) => Promise<void>;
removeBookmark: (odid: string, candidateId: string) => Promise<void>;
isBookmarked: (candidateId: string) => boolean;
endorseAllBookmarks: (odid: string) => Promise<void>;
endorseSelectedBookmarks: (odid: string, candidateIds: string[]) => Promise<void>;
```

**Change endorse button behavior in PSACard:**

```tsx
const handleEndorsePress = async () => {
  if (!isVerified) {
    // Bookmark instead of endorsing
    await bookmarkCandidate(user.id, candidate.id);
    Alert.alert(
      'Candidate Bookmarked',
      `${candidate.displayName} has been saved to your bookmarks. Complete identity verification to submit your endorsements.`,
      [
        { text: 'OK', style: 'cancel' },
        { text: 'Verify Now', onPress: () => router.push('/(auth)/verify-identity') },
      ]
    );
    return;
  }

  // Normal endorse/un-endorse toggle for verified users
  await handleEndorseToggle();
};
```

The endorse button should visually indicate bookmark state for unverified users:
- Not bookmarked: icon='bookmark-outline', text='Save'
- Bookmarked: icon='bookmark', text='Saved'
- Verified + not endorsed: icon='thumb-up', text='Endorse'
- Verified + endorsed: icon='check', text='Endorsed'

### 5\. Bookmark queue on For You page

Add a visible bookmark count/badge at the top of the For You page:

```tsx
const { bookmarks } = useUserStore();

{bookmarks.length > 0 && !isVerified && (
  <Card style={styles.bookmarkBanner}>
    <View style={styles.bookmarkBannerContent}>
      <MaterialCommunityIcons name="bookmark-multiple" size={24} color={theme.colors.primary} />
      <Text variant="bodyMedium" style={{ flex: 1, marginLeft: 8 }}>
        {bookmarks.length} candidate{bookmarks.length !== 1 ? 's' : ''} bookmarked
      </Text>
      <PrimaryButton compact onPress={() => router.push('/(auth)/verify-identity')}>
        Verify to Endorse
      </PrimaryButton>
    </View>
  </Card>
)}
```

### 6\. Post-verification endorsement flow

When a user completes verification, navigate them to the endorsements page where they see their bookmarks and can choose to:
- **"Endorse All"** — endorses all bookmarked candidates at once
- **Select individual** — tap to endorse specific bookmarked candidates

This UI is detailed further in PLAN-14 (Profile Fixes — endorsements page layout).

## Testing

- Tap share on a candidate when unverified → shows verification prompt
- Tap "Verify" in prompt → navigates to verify identity screen
- Tap share when verified → shows native share sheet
- Tap alignment badge on any candidate card → alignment explainer modal appears with same content as candidate profile page
- Unverified user taps endorse → candidate is bookmarked with confirmation popup
- Bookmark count badge appears on For You page header
- Verified user taps endorse → normal endorse toggle behavior
- After completing verification, bookmarked candidates appear in endorsements page with "Endorse All" option
