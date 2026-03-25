# PLAN: Profile Page Fixes

## Summary

- Make profile circle show "YN" placeholder and replace "Anonymous" with "Your Name"
- Show "Unverified" label under the display name
- Hide the "Run for Office" CTA during the beta — keep the full flow intact in the codebase but remove the UI entry points so users cannot access it yet
- On the "My Endorsements" page: show **"Endorsed"** candidates at the top, a dividing line, then **"Bookmarked"** candidates below. If the user has not verified, show only "Bookmarked" candidates with a message prompting them to complete verification to endorse
- Simplify the candidate list on "My Endorsements" to look like the leaderboard — just a list of candidate names linking to their profiles (no cards with stats/issues)
- Fix back button navigation: every link on the profile page currently goes to the home page when the user clicks "back" — this needs to be fixed so the user returns to the profile page

## Current State

File: `app/(tabs)/profile.tsx`

**Profile Header (lines 185-213):**

```
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

**My Endorsements page:** `app/settings/endorsements.tsx` shows endorsed candidates as cards with avatar, name, endorsement count, and top 3 issues. No bookmarking concept exists yet.

**Back button issue:** Settings screens are routed via `router.push()` from the Profile tab, but they exist as top-level routes under `app/settings/` rather than nested within the Profile tab. This means pressing "back" may navigate to the root tab (Home) instead of back to Profile.

## Files to Modify

- `app/(tabs)/profile.tsx` — header changes, hide Run for Office CTA
- `app/settings/endorsements.tsx` — redesign with endorsed/bookmarked sections, simplified list
- `app/settings/_layout.tsx` — ensure `headerBackTitle` is set to 'Profile' and back navigation works correctly

## Implementation Details

### 1\. Update profile header — "YN" circle and "Unverified" label

Replace the profile header section (lines 185-213):

```
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

### 2\. Hide the "Run for Office" CTA (keep code, hide UI)

Comment out or conditionally hide the CTA in `app/(tabs)/profile.tsx` (lines 215-248) using a feature flag or a simple `false &&` guard:

```tsx
{/* Hidden during beta — Run for Office flow is preserved but not accessible */}
{false && !isCandidate && !hasPendingApplication && (
  <Card style={[styles.ctaCard, ...]}>
    ...Run for Office...
  </Card>
)}
```

Also hide the same CTA in `src/components/home/VoterHome.tsx` (lines 182-208):

```tsx
{/* Hidden during beta */}
{false && (
  <Card style={[styles.ctaCard, { backgroundColor: theme.colors.primaryContainer }]}>
    ...Want to Run for Office?...
  </Card>
)}
```

**Do not delete the code or styles** — this will be re-enabled post-beta.

### 3\. Redesign "My Endorsements" page with endorsed/bookmarked sections

Completely redesign `app/settings/endorsements.tsx` to show two sections with a simplified list format (matching the leaderboard style):

```tsx
// Fetch both endorsements and bookmarks
const { endorsements, bookmarks, fetchEndorsements } = useUserStore();
const { user: currentUser } = useAuthStore();
const isVerified = userProfile?.verificationStatus === 'verified';

useEffect(() => {
  if (currentUser?.id) {
    fetchEndorsements(currentUser.id);
  }
}, [currentUser?.id]);

const activeEndorsements = endorsements.filter(e => e.isActive);
```

**Layout:**

```tsx
<ScrollView>
  {/* Endorsed Section — only shown if user has endorsements */}
  {activeEndorsements.length > 0 && (
    <>
      <Text variant="titleMedium" style={styles.sectionHeader}>Endorsed</Text>
      {activeEndorsements.map((endorsement, index) => (
        <Pressable
          key={endorsement.id}
          onPress={() => router.push(`/candidate/${endorsement.candidateId}`)}
          style={styles.candidateRow}
        >
          <Text style={styles.rankNumber}>{index + 1}</Text>
          <UserAvatar size={36} displayName={endorsement.candidateName} />
          <Text variant="bodyLarge" style={styles.candidateName}>
            {endorsement.candidateName}
          </Text>
          <MaterialCommunityIcons name="chevron-right" size={20} />
        </Pressable>
      ))}
    </>
  )}

  {/* Dividing line between sections */}
  {activeEndorsements.length > 0 && bookmarks.length > 0 && (
    <View style={styles.divider} />
  )}

  {/* Bookmarked Section */}
  {bookmarks.length > 0 && (
    <>
      <Text variant="titleMedium" style={styles.sectionHeader}>Bookmarked</Text>

      {/* Verification prompt for unverified users */}
      {!isVerified && (
        <Card style={styles.verifyPrompt}>
          <Text variant="bodyMedium">
            Complete identity verification to endorse your bookmarked candidates.
          </Text>
          <PrimaryButton
            compact
            onPress={() => router.push('/(auth)/verify-identity')}
            style={{ marginTop: 8 }}
          >
            Verify Identity
          </PrimaryButton>
        </Card>
      )}

      {/* Endorse All button for verified users with bookmarks */}
      {isVerified && (
        <PrimaryButton
          icon="thumb-up"
          onPress={handleEndorseAllBookmarks}
          style={{ marginBottom: 12 }}
        >
          Endorse All Bookmarked
        </PrimaryButton>
      )}

      {bookmarks.map((bookmark, index) => (
        <Pressable
          key={bookmark.id}
          onPress={() => router.push(`/candidate/${bookmark.candidateId}`)}
          style={styles.candidateRow}
        >
          <Text style={styles.rankNumber}>{index + 1}</Text>
          <UserAvatar size={36} displayName={bookmark.candidateName} />
          <Text variant="bodyLarge" style={styles.candidateName}>
            {bookmark.candidateName}
          </Text>
          {isVerified && (
            <IconButton
              icon="thumb-up-outline"
              size={18}
              onPress={() => endorseCandidate(currentUser.id, bookmark.candidateId)}
            />
          )}
          <MaterialCommunityIcons name="chevron-right" size={20} />
        </Pressable>
      ))}
    </>
  )}

  {/* Empty state */}
  {activeEndorsements.length === 0 && bookmarks.length === 0 && (
    <View style={styles.emptyState}>
      <Text>No endorsements or bookmarks yet.</Text>
      <PrimaryButton onPress={() => router.push('/(tabs)/for-you')}>
        Browse Candidates
      </PrimaryButton>
    </View>
  )}
</ScrollView>
```

**Simplified list styles (match leaderboard):**

```ts
candidateRow: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingVertical: 12,
  paddingHorizontal: 16,
  borderBottomWidth: 1,
  borderBottomColor: '#F0F0F0',
},
rankNumber: {
  width: 24,
  fontSize: 14,
  color: '#999',
  textAlign: 'center',
},
candidateName: {
  flex: 1,
  marginLeft: 12,
},
sectionHeader: {
  fontWeight: 'bold',
  paddingHorizontal: 16,
  paddingVertical: 12,
},
divider: {
  height: 1,
  backgroundColor: '#E0E0E0',
  marginVertical: 8,
  marginHorizontal: 16,
},
```

### 4\. Fix back button navigation from profile sub-screens

The issue is that settings screens (`app/settings/*`) are top-level stack routes, not nested inside the Profile tab. When a user navigates from Profile to a settings screen and presses back, Expo Router may go to the root tab (Home) instead of Profile.

**Solution A (preferred):** Ensure `app/settings/_layout.tsx` has correct back navigation:

```tsx
<Stack
  screenOptions={{
    headerBackTitle: 'Profile',
    headerStyle: { backgroundColor: theme.colors.surface },
    headerTintColor: theme.colors.onSurface,
    headerShadowVisible: false,
  }}
>
```

**Solution B (if A doesn't work):** Move settings screens into the Profile tab as nested routes per PLAN-08 (Persistent Footer Bar). This would restructure to:

```
app/(tabs)/profile/
  _layout.tsx        ← Stack navigator
  index.tsx          ← current profile.tsx
  personal-info.tsx  ← moved from app/settings/
  endorsements.tsx   ← moved from app/settings/
  issues.tsx         ← moved from app/settings/
```

This ensures back navigation always returns to the Profile tab since the screens are nested within it.

**Solution C (immediate fix):** In each settings screen, if the Stack header back button doesn't work correctly, add a custom header with `router.back()`:

```tsx
// Verify that verify-identity.tsx uses router.back() not router.replace()
// See PLAN-15 for the full navigation audit
```

## Testing

- Profile shows "YN" initials when no profile photo is set and name is default
- "Unverified" appears under the display name for unverified users
- "Verified" appears (in primary color) for verified users
- "Run for Office" card is NOT visible on either Profile or Home screens, but the code is preserved
- My Endorsements page shows "Endorsed" section at top with simple name list
- Dividing line separates "Endorsed" from "Bookmarked" section
- Unverified users see only "Bookmarked" with verification prompt
- Verified users see "Endorse All Bookmarked" button
- Tapping a candidate name navigates to their profile
- Candidate list is simple (like leaderboard) — no cards with stats/issues
- Pressing back from any profile sub-screen returns to the Profile page, not Home
