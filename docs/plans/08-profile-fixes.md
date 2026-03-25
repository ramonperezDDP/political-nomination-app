# PLAN: Profile Page Fixes

## Summary
- Make profile circle show "YN" placeholder and replace "Anonymous" with "Your Name"
- Show "Unverified" label under the display name
- Remove the "Run for Office" window
- Fix "My Endorsements" not showing endorsed candidates

## Current State
File: `app/(tabs)/profile.tsx`

**Profile Header (lines 185-213):**
```tsx
<UserAvatar
  photoUrl={user?.photoUrl || undefined}
  displayName={user?.displayName || 'User'}
  size={80}
/>
<View style={styles.headerInfo}>
  <Text variant="headlineSmall">{user?.displayName || 'User'}</Text>
  <Text variant="bodyMedium">{user?.email}</Text>
  <View style={styles.roleBadge}>
    <Chip label={isCandidate ? 'Candidate' : 'Voter'} ... />
    {userProfile?.verificationStatus === 'verified' && (
      <MaterialCommunityIcons name="check-decagram" ... />
    )}
  </View>
</View>
```

**Run for Office CTA (lines 216-248):** Renders when `!isCandidate && !hasPendingApplication`

**UserAvatar component:** `src/components/ui/Avatar.tsx:73-87` — generates initials from displayName

**My Endorsements bug:** The endorsements list (`app/settings/endorsements.tsx`) fetches candidates on mount (lines 31-52), but the `endorsements` array from `useUserStore()` may not be populated if `fetchEndorsements()` wasn't called.

## Files to Modify
- `app/(tabs)/profile.tsx` — header changes, remove Run for Office CTA
- `app/settings/endorsements.tsx` — fix data loading
- `src/stores/userStore.ts` — ensure endorsements are fetched on init

## Implementation Details

### 1. Update profile header — "YN" circle and "Unverified" label

Replace the profile header section (lines 185-213):

```tsx
{/* Profile Header */}
<View style={styles.header}>
  <UserAvatar
    photoUrl={user?.photoUrl || undefined}
    displayName={user?.displayName || 'Your Name'}
    size={80}
  />
  <View style={styles.headerInfo}>
    <Text variant="headlineSmall" style={styles.displayName}>
      {user?.displayName || 'Your Name'}
    </Text>
    {/* Verification status label */}
    <Text
      variant="bodySmall"
      style={{
        color: userProfile?.verificationStatus === 'verified'
          ? theme.colors.primary
          : theme.colors.outline,
        marginTop: 2,
      }}
    >
      {userProfile?.verificationStatus === 'verified' ? 'Verified' : 'Unverified'}
    </Text>
    <Text variant="bodyMedium" style={{ color: theme.colors.outline, marginTop: 4 }}>
      {user?.email}
    </Text>
    <View style={styles.roleBadge}>
      <Chip
        label={isCandidate ? 'Candidate' : 'Voter'}
        variant={isCandidate ? 'success' : 'info'}
      />
      {userProfile?.verificationStatus === 'verified' && (
        <MaterialCommunityIcons
          name="check-decagram"
          size={20}
          color={theme.colors.primary}
          style={{ marginLeft: 8 }}
        />
      )}
    </View>
  </View>
</View>
```

The `UserAvatar` component already generates initials from `displayName`. If the display name is "Your Name", it will show "YN". For logged-in users with real names, it'll show their actual initials.

### 2. Remove the "Run for Office" CTA

Delete the entire block at lines 215-248:

```tsx
// REMOVE this block:
{!isCandidate && !hasPendingApplication && (
  <Card style={[styles.ctaCard, ...]}>
    ...Run for Office...
  </Card>
)}
```

Also remove the associated styles: `ctaCard`, `ctaContent`, `ctaText` (lines 373-385).

### 3. Fix "My Endorsements" not loading

The issue is that `endorsements` in the user store may be empty if `fetchEndorsements()` hasn't been called. Add a fetch on mount in the endorsements screen:

In `app/settings/endorsements.tsx`, add endorsement fetching:

```tsx
// Add to imports
import { useAuthStore } from '@/stores';

// Inside component, before the useEffect:
const { user: currentUser } = useAuthStore();
const { endorsements, revokeEndorsement, fetchEndorsements } = useUserStore();

// Add fetch on mount
useEffect(() => {
  if (currentUser?.id) {
    fetchEndorsements(currentUser.id);
  }
}, [currentUser?.id]);
```

Also ensure endorsements are fetched when user profile loads. In `src/stores/userStore.ts`, add endorsement fetching to `subscribeToProfile`:

```typescript
subscribeToProfile: (userId: string) => {
  // ... existing subscription logic

  // Also fetch endorsements when profile loads
  get().fetchEndorsements(userId);

  // ... return unsubscribe
},
```

### 4. Also remove "Run for Office" CTA from VoterHome

The same CTA appears at the bottom of `src/components/home/VoterHome.tsx` (lines 182-208). Remove that block:

```tsx
// REMOVE:
<Card style={[styles.ctaCard, { backgroundColor: theme.colors.primaryContainer }]}>
  ...Want to Run for Office?...
</Card>
```

And associated styles: `ctaCard`, `ctaContent`, `ctaText`, `ctaButton` (lines 277-290).

## Testing
- Profile shows "YN" initials when no profile photo is set and name is default
- "Unverified" appears under the display name for unverified users
- "Verified" appears (in primary color) for verified users
- "Run for Office" card is gone from both Profile and Home screens
- Navigate to My Endorsements → endorsed candidates appear correctly
- After endorsing someone on For You page, returning to My Endorsements shows them
