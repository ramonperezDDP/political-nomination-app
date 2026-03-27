# Plan 04: For You Page — TikTok-Style Rework — ✅ COMPLETE

> **Completed 2026-03-27.** Full-screen paging FlatList, FullScreenPSA with video/photo fallback, AlignmentCircle (green/yellow/orange tiers), EndorseLockModal, QuizPromptCard, district-gated endorsements. All prerequisites (subscribeToProfile, district/zone fields) in place.

**Feedback:** Full-screen PSA videos one at a time (TikTok/Reels style), vertical swipe only. Alignment circle with orange/yellow/green colors. "Perfectly aligned" badge for 100% match. Experience dropdown menu (Plan 05). Tab bar remains visible. All PNs are required to have PSAs. Mass endorsement after filtering (Plans 02/05).

---

## Code Analysis (2026-03-04)

> Deep analysis of the codebase revealed several critical discrepancies between the
> original plan and the actual runtime behavior. All issues are documented below and
> the code samples have been corrected.

### Critical Issue 1: `useUserStore.userProfile` is never populated

The original plan used `useUserStore((s) => s.userProfile)` for user data. However,
`subscribeToProfile()` is **never called** anywhere in the app. The real-time user
data lives in `useAuthStore((s) => s.user)` via `subscribeToUser()` (initialized in
`_layout.tsx`). The current working `for-you.tsx` already uses `useAuthStore`.

**Fix:** All `userStore` selectors (`selectCanSeeAlignment`, `selectEndorseLockReason`,
`selectFullyVerified`, `selectHasAccount`, `selectUserDistrictIds`) depend on
`state.userProfile` which is always `null`. Before implementing this plan, add one
line to `_layout.tsx` to initialize the user store subscription:

```tsx
// In app/_layout.tsx, inside the useEffect that fetches endorsements:
useEffect(() => {
  if (user?.id) {
    fetchEndorsements(user.id);
    const unsubProfile = useUserStore.getState().subscribeToProfile(user.id);
    return () => unsubProfile();
  }
}, [user?.id, fetchEndorsements]);
```

Alternatively, all components can read user data from `useAuthStore((s) => s.user)`
directly and pass values to selectors as function arguments. The subscription approach
is simpler because it makes all existing selectors work without rewriting them.

### Critical Issue 2: `CandidatePreview` missing `district` field

The plan references `candidate.district` in FullScreenPSA (for `selectEndorseLockReason`)
and MassEndorseButton (for filtering by district). The `CandidatePreview` type has
no `district` field, and `generateFeedItem` doesn't include it.

**Fix (2 changes):**

```ts
// 1. In src/types/index.ts — add district to CandidatePreview:
export interface CandidatePreview {
  id: string;
  displayName: string;
  photoUrl?: string;
  gender?: Gender;
  topIssues: string[];
  endorsementCount: number;
  averageSpectrum: number;
  district: string;          // ← ADD
}

// 2. In app/(tabs)/for-you.tsx — generateFeedItem, add to candidate object:
candidate: {
  ...existing fields,
  district: candidate.district,   // ← ADD
}
```

### Critical Issue 3: `FeedItem` needs `type` discriminator for quiz prompt

The plan prepends `{ id: 'quiz-prompt', type: 'prompt' }` to the display list.
`FeedItem` has no `type` field. Rather than modify the shared `FeedItem` type, use
a local discriminated union in `for-you.tsx`:

```ts
type DisplayItem =
  | (FeedItem & { type?: 'candidate' })
  | { id: string; type: 'prompt' };
```

### Moderate Issue 4: Video fallback for empty `videoUrl`

Current seed data has `videoUrl: ''`. The `<Video>` component will render nothing
for candidates without videos. FullScreenPSA must show a fallback: candidate photo
as full-screen background with gradient overlay.

### Moderate Issue 5: Static `Dimensions.get('window')`

Using `Dimensions.get('window')` at module level won't respond to rotation/resizing.
Use `useWindowDimensions()` hook inside components instead.

### Moderate Issue 6: `EndorseLockModal` had no implementation

The original plan referenced `EndorseLockModal` in FullScreenPSA code but never
provided its implementation. Full code is now included below.

---

## Current State

### `app/(tabs)/for-you.tsx`

- Vertical `FlatList` of `PSACard` components (card-based, not full-screen)
- Uses `useAuthStore` for user data (real-time Firestore subscription)
- Uses `useConfigStore` for issues
- Search bar at top with autocomplete
- Issue pills for filtering (horizontal scroll)
- Filter menu: All Candidates, High Alignment (80%+), No Dealbreakers, My Community
- `generateFeedItem` builds `CandidatePreview` from candidate + user data

### `src/components/feed/PSACard.tsx`

- Card layout: 180px video + info section below
- Alignment badge (top-right of video): 48x48px circle
- Colors: green (80-100%), light-green (60-79%), orange (40-59%), deep-orange (20-39%), red (0-19%)
- Shows candidate name, stats, matched issues, endorse/share/profile buttons
- Tappable dealbreaker badge (top-left of video): red pill with alert icon; on tap opens a centered modal listing each triggered dealbreaker with its name, description, and the candidate's actual position

### `app/candidate/[id].tsx`

- Candidate profile page
- Tappable dealbreaker badge (top-left of header): same as PSACard — on tap opens a centered modal listing triggered dealbreakers with candidate's positions

---

## Proposed Design

### Full-Screen TikTok Layout

Each PSA takes up the **entire screen**. User swipes **vertically only** to move between PSAs. Overlaid UI elements sit on top of the video. The bottom tab bar remains visible for navigation.

```
┌─────────────────────────────────────────────┐
│                                             │
│  [72% ●]                    [Experience ▼]  │
│  (alignment)                (filter menu)   │
│                                             │
│                                             │
│              FULL SCREEN                    │
│                VIDEO                        │
│                                             │
│                                             │
│                                             │
│                                             │
│  @CandidateName                  [♡ Endorse]│
│  "My position on Healthcare"     [👤 Profile]│
│  🏷 Healthcare  🏷 Economy       [↗ Share]  │
│                                  [🔇 Mute]  │
│                                             │
├─────────────────────────────────────────────┤
│  Home  │  For You  │  Leaderboard │ Profile │
└─────────────────────────────────────────────┘
```

---

## Pre-Implementation Steps

Before implementing the main UI changes, these prerequisite changes must be made:

### Step 0a. Initialize `userStore` profile subscription in `app/_layout.tsx`

Add `subscribeToProfile` call so all `userStore` selectors work:

```tsx
// In the useEffect that fetches endorsements (~line 107):
useEffect(() => {
  if (user?.id) {
    fetchEndorsements(user.id);
    const unsubProfile = useUserStore.getState().subscribeToProfile(user.id);
    return () => unsubProfile();
  }
}, [user?.id, fetchEndorsements]);
```

### Step 0b. Add `district` to `CandidatePreview` in `src/types/index.ts`

```ts
export interface CandidatePreview {
  id: string;
  displayName: string;
  photoUrl?: string;
  gender?: Gender;
  topIssues: string[];
  endorsementCount: number;
  averageSpectrum: number;
  district: string;          // NEW — needed for endorsement gating
}
```

### Step 0c. Pass `district` in `generateFeedItem` in `app/(tabs)/for-you.tsx`

```ts
candidate: {
  id: candidate.id,
  displayName: user?.displayName || 'Candidate',
  photoUrl: user?.photoUrl,
  gender: user?.gender || inferGenderFromName(user?.displayName || ''),
  topIssues: candidateIssueIds.slice(0, 3).map(
    (id) => issues.find((i) => i.id === id)?.name || id
  ),
  endorsementCount: candidate.endorsementCount || 0,
  averageSpectrum: candidate.topIssues?.length
    ? Math.round(candidate.topIssues.reduce((sum, i) => sum + i.spectrumPosition, 0) / candidate.topIssues.length)
    : 0,
  district: candidate.district,   // NEW
},
```

---

## Files to Modify

### 1\. `app/(tabs)/for-you.tsx` — Complete layout rework

**Replace the current FlatList + PSACard layout with a paging FlatList.**

Key changes from original plan:
- Uses `useAuthStore` for user data (not `useUserStore.userProfile`)
- Uses `useUserStore` only for selectors and endorsement actions
- Uses `useWindowDimensions()` instead of static `Dimensions.get('window')`
- Local `DisplayItem` union type for quiz prompt vs feed items

```tsx
import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Platform,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore, useConfigStore } from '@/stores';
import { useUserStore, selectCanSeeAlignment, selectHasAccount } from '@/stores';
import { getCandidatesForFeed, reseedAllData, inferGenderFromName } from '@/services/firebase/firestore';
import { calculateAlignmentScore } from '@/utils/alignment';
import FullScreenPSA from '@/components/feed/FullScreenPSA';
import ExperienceMenu from '@/components/feed/ExperienceMenu';
import QuizPromptCard from '@/components/feed/QuizPromptCard';
import MassEndorseButton from '@/components/feed/MassEndorseButton';
import type { FeedItem, Candidate, User } from '@/types';

type ExperienceFilter = 'random' | 'issues' | 'most_important' | 'location';

// Discriminated union for display items (feed items + quiz prompt)
type DisplayItem =
  | (FeedItem & { type?: 'candidate' })
  | { id: string; type: 'prompt' };

// generateFeedItem stays the same as current implementation but adds:
//   district: candidate.district
// to the candidate sub-object (see Step 0c above)

export default function ForYouScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // User data from authStore (has real-time Firestore subscription)
  const { user } = useAuthStore();
  const { issues } = useConfigStore();

  // Selectors from userStore (requires Step 0a subscription)
  const canSeeAlignment = useUserStore(selectCanSeeAlignment);

  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [experienceFilter, setExperienceFilter] = useState<ExperienceFilter>(
    canSeeAlignment ? 'issues' : 'random'
  );

  // Auto-switch to 'issues' when user completes quiz minimum while app is open
  useEffect(() => {
    if (canSeeAlignment && experienceFilter === 'random') {
      setExperienceFilter('issues');
    }
  }, [canSeeAlignment]);

  // Data fetching — same pattern as current for-you.tsx
  useEffect(() => {
    const loadFeed = async () => {
      if (issues.length === 0) return;
      setIsLoading(true);
      try {
        let candidatesData = await getCandidatesForFeed();
        if (candidatesData.length === 0) {
          await reseedAllData();
          candidatesData = await getCandidatesForFeed();
        }
        const userIssues = user?.selectedIssues || [];
        const userDealbreakers = user?.dealbreakers || [];
        const userResponses = user?.questionnaireResponses || [];
        const items = candidatesData.map(({ candidate, user: candidateUser }) =>
          generateFeedItem(candidate, candidateUser, userIssues, userDealbreakers, issues, userResponses)
        );
        items.sort((a, b) => (b.alignmentScore ?? -1) - (a.alignmentScore ?? -1));
        setFeedItems(items);
      } catch (error) {
        console.warn('Error loading feed:', error);
      }
      setIsLoading(false);
    };
    loadFeed();
  }, [issues, user]);

  // Apply experience filter (see Plan 05 for full filter logic)
  const filteredItems = useMemo(() => {
    switch (experienceFilter) {
      case 'issues':
        return feedItems.filter((item) => item.matchedIssues.length > 0);
      case 'most_important':
        return feedItems.filter((item) => !item.hasDealbreaker);
      case 'location':
        return feedItems; // Filtered by LocationMapModal selection
      case 'random':
      default:
        return [...feedItems].sort(() => Math.random() - 0.5);
    }
  }, [feedItems, experienceFilter]);

  // Paging FlatList item height = full screen minus tab bar
  const itemHeight = screenHeight - insets.bottom;

  // Prepend quiz prompt if user hasn't completed quiz (Plan 06)
  const displayItems: DisplayItem[] = useMemo(() => {
    if (!canSeeAlignment) {
      return [
        { id: 'quiz-prompt', type: 'prompt' as const },
        ...filteredItems,
      ];
    }
    return filteredItems;
  }, [filteredItems, canSeeAlignment]);

  return (
    <View style={[styles.container, { backgroundColor: '#000' }]}>
      <StatusBar barStyle="light-content" />

      {/* Experience dropdown - positioned absolutely (Plan 05) */}
      <ExperienceMenu
        selectedFilter={experienceFilter}
        onFilterChange={setExperienceFilter}
        style={[styles.experienceMenu, { top: insets.top + 8 }]}
      />

      {/* Mass Endorse button — shown when filter is active and user can endorse */}
      <MassEndorseButton
        filteredItems={filteredItems}
        experienceFilter={experienceFilter}
        style={[styles.massEndorseButton, { top: insets.top + 48 }]}
      />

      {/* Full-screen paging list — vertical swipe only */}
      <FlatList
        data={displayItems}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => {
          if (item.type === 'prompt') {
            return <QuizPromptCard height={itemHeight} />;
          }
          return (
            <FullScreenPSA
              feedItem={item as FeedItem}
              isActive={index === activeIndex}
              height={itemHeight}
            />
          );
        }}
        pagingEnabled
        snapToInterval={itemHeight}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        horizontal={false}
        onMomentumScrollEnd={(e) => {
          const newIndex = Math.round(
            e.nativeEvent.contentOffset.y / itemHeight
          );
          setActiveIndex(newIndex);
        }}
        getItemLayout={(_, index) => ({
          length: itemHeight,
          offset: itemHeight * index,
          index,
        })}
      />
    </View>
  );
}
```

### 2\. New Component: `src/components/feed/FullScreenPSA.tsx`

**Replaces PSACard in the For You feed with a full-screen video + overlaid controls.**

Key changes from original plan:
- Uses `useAuthStore` for user ID (needed for endorse/revoke calls)
- Uses `useUserStore` for selectors and endorsement actions
- `endorseCandidate` / `revokeEndorsement` require `(userId, candidateId)` — not just `(candidateId)`
- Shows candidate photo fallback when `videoUrl` is empty
- Uses `useWindowDimensions()` for screen width

```tsx
import React, { useRef, useState } from 'react';
import { View, Pressable, StyleSheet, Image, useWindowDimensions } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { Video, ResizeMode } from 'expo-av';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores';
import { useUserStore, selectCanSeeAlignment, selectEndorseLockReason, selectHasAccount } from '@/stores';
import AlignmentCircle from './AlignmentCircle';
import EndorseLockModal from './EndorseLockModal';
import type { FeedItem } from '@/types';

interface FullScreenPSAProps {
  feedItem: FeedItem;
  isActive: boolean;
  height: number;
}

export default function FullScreenPSA({ feedItem, isActive, height }: FullScreenPSAProps) {
  const theme = useTheme();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const videoRef = useRef<Video>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const { candidate, psa, alignmentScore, matchedIssues, hasDealbreaker } = feedItem;

  // Auth store for user ID (real-time data)
  const currentUser = useAuthStore((s) => s.user);

  // User store selectors (requires subscribeToProfile in _layout.tsx)
  const canSeeAlignment = useUserStore(selectCanSeeAlignment);
  const hasAccount = useUserStore(selectHasAccount);
  const hasEndorsed = useUserStore((s) => s.hasEndorsedCandidate(candidate.id));
  const endorseCandidate = useUserStore((s) => s.endorseCandidate);
  const revokeEndorsement = useUserStore((s) => s.revokeEndorsement);
  const lockReason = useUserStore(selectEndorseLockReason(candidate.district));
  const canEndorse = lockReason === null;

  const [showLockModal, setShowLockModal] = useState(false);

  const handleEndorsePress = () => {
    if (!canEndorse) {
      setShowLockModal(true);
      return;
    }
    if (!currentUser?.id) return;
    // endorseCandidate/revokeEndorsement require (userId, candidateId)
    if (hasEndorsed) revokeEndorsement(currentUser.id, candidate.id);
    else endorseCandidate(currentUser.id, candidate.id);
  };

  const hasVideo = psa.videoUrl && psa.videoUrl.length > 0;

  return (
    <View style={[styles.container, { height, width: screenWidth }]}>
      {/* Full-screen video background (or photo fallback) */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => setIsPaused((p) => !p)}
      >
        {hasVideo ? (
          <Video
            ref={videoRef}
            source={{ uri: psa.videoUrl }}
            style={StyleSheet.absoluteFill}
            resizeMode={ResizeMode.COVER}
            shouldPlay={isActive && !isPaused}
            isLooping
            isMuted={isMuted}
          />
        ) : (
          /* Fallback: candidate photo with dark gradient */
          <View style={[StyleSheet.absoluteFill, styles.photoFallback]}>
            {candidate.photoUrl ? (
              <Image
                source={{ uri: candidate.photoUrl }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: '#1a1a2e' }]}>
                <MaterialCommunityIcons
                  name="account"
                  size={120}
                  color="rgba(255,255,255,0.15)"
                  style={styles.fallbackIcon}
                />
              </View>
            )}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} />
          </View>
        )}
      </Pressable>

      {/* Gradient overlay at bottom for readability */}
      <View style={styles.bottomGradient} pointerEvents="none" />

      {/* Dealbreaker badge — top left, above alignment circle */}
      {hasDealbreaker && (
        <View style={styles.dealbreakerBadge}>
          <MaterialCommunityIcons name="alert-circle" size={16} color="#fff" />
          <Text style={styles.dealbreakerText}>Dealbreaker</Text>
        </View>
      )}

      {/* Alignment circle — top left */}
      <AlignmentCircle
        score={canSeeAlignment ? alignmentScore : null}
        style={styles.alignmentCircle}
      />

      {/* Right-side action buttons (TikTok style) */}
      <View style={styles.rightActions}>
        {/* Candidate avatar */}
        <Pressable
          onPress={() => router.push(`/candidate/${candidate.id}`)}
          style={styles.actionButton}
        >
          <View style={styles.avatarCircle}>
            <MaterialCommunityIcons name="account" size={28} color="#fff" />
          </View>
        </Pressable>

        {/* Endorse */}
        <Pressable onPress={handleEndorsePress} style={styles.actionButton}>
          <MaterialCommunityIcons
            name={!canEndorse ? 'lock' : hasEndorsed ? 'heart' : 'heart-outline'}
            size={32}
            color={!canEndorse ? 'rgba(255,255,255,0.5)' : hasEndorsed ? '#de482e' : '#fff'}
          />
          <Text style={styles.actionLabel}>
            {candidate.endorsementCount}
          </Text>
        </Pressable>

        {/* Share */}
        <Pressable style={styles.actionButton}>
          <MaterialCommunityIcons name="share" size={28} color="#fff" />
          <Text style={styles.actionLabel}>Share</Text>
        </Pressable>

        {/* Mute toggle (only shown when video exists) */}
        {hasVideo && (
          <Pressable
            onPress={() => setIsMuted((m) => !m)}
            style={styles.actionButton}
          >
            <MaterialCommunityIcons
              name={isMuted ? 'volume-off' : 'volume-high'}
              size={28}
              color="#fff"
            />
          </Pressable>
        )}
      </View>

      {/* Bottom info overlay */}
      <View style={styles.bottomInfo}>
        <Text style={styles.candidateName}>@{candidate.displayName}</Text>
        <Text style={styles.psaTitle}>{psa.title}</Text>
        {matchedIssues.length > 0 && (
          <View style={styles.issueTags}>
            {matchedIssues.slice(0, 3).map((issueId) => (
              <View key={issueId} style={styles.issueTag}>
                <Text style={styles.issueTagText}>
                  {issueId}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Lock modal for endorsement gating */}
      <EndorseLockModal
        visible={showLockModal}
        reason={lockReason}
        hasAccount={hasAccount}
        onDismiss={() => setShowLockModal(false)}
        onSignUp={() => router.push('/(auth)/register')}
        onVerify={() => router.push('/(auth)/verify-identity' as any)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
    position: 'relative',
  },
  photoFallback: {
    backgroundColor: '#1a1a2e',
  },
  fallbackIcon: {
    position: 'absolute',
    top: '35%',
    alignSelf: 'center',
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  dealbreakerBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244,67,54,0.85)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  dealbreakerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  alignmentCircle: {
    position: 'absolute',
    top: 48,
    left: 16,
  },
  rightActions: {
    position: 'absolute',
    right: 12,
    bottom: 120,
    alignItems: 'center',
    gap: 20,
  },
  actionButton: {
    alignItems: 'center',
  },
  actionLabel: {
    color: '#fff',
    fontSize: 12,
    marginTop: 2,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  bottomInfo: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 80,
  },
  candidateName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  psaTitle: {
    color: '#fff',
    fontSize: 14,
    marginTop: 4,
  },
  issueTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  issueTag: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  issueTagText: {
    color: '#fff',
    fontSize: 12,
  },
});
```

### 3\. New Component: `src/components/feed/AlignmentCircle.tsx`

**Alignment circle with updated colors: orange/yellow/green. Shows "?" when user hasn't completed the quiz.**

```tsx
import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface AlignmentCircleProps {
  score: number | null;  // null = quiz not completed (show "?")
  style?: ViewStyle;
}

// New color tiers per feedback:
// 0-30%: Orange
// 31-60%: Yellow
// 61-100%: Green
// 100%: "Perfectly Aligned" special state
function getAlignmentColor(score: number): string {
  if (score >= 61) return '#4caf50'; // Green
  if (score >= 31) return '#ffc107'; // Yellow/Amber
  return '#ff9800';                  // Orange
}

export default function AlignmentCircle({ score, style }: AlignmentCircleProps) {
  // No quiz completed — show "?" with tooltip hint
  if (score === null) {
    return (
      <View style={[styles.circle, { borderColor: 'rgba(255,255,255,0.4)' }, style]}>
        <Text style={[styles.scoreText, { color: 'rgba(255,255,255,0.6)' }]}>?</Text>
      </View>
    );
  }

  const roundedScore = Math.round(score);
  const color = getAlignmentColor(roundedScore);
  const isPerfect = roundedScore === 100;

  if (isPerfect) {
    return (
      <View style={[styles.perfectContainer, style]}>
        <MaterialCommunityIcons name="check-circle" size={20} color="#00e676" />
        <Text style={styles.perfectText}>Perfectly{'\n'}Aligned</Text>
      </View>
    );
  }

  return (
    <View style={[styles.circle, { borderColor: color }, style]}>
      <Text style={[styles.scoreText, { color }]}>{roundedScore}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  scoreText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  perfectContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  perfectText: {
    color: '#00e676',
    fontSize: 11,
    fontWeight: 'bold',
    lineHeight: 13,
  },
});
```

### 4\. New Component: `src/components/feed/EndorseLockModal.tsx`

**Modal explaining why endorsement is locked. Shows appropriate CTA based on user state.**

```tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Modal } from '@/components/ui';

interface EndorseLockModalProps {
  visible: boolean;
  reason: string | null;
  hasAccount: boolean;
  onDismiss: () => void;
  onSignUp: () => void;
  onVerify: () => void;
}

export default function EndorseLockModal({
  visible,
  reason,
  hasAccount,
  onDismiss,
  onSignUp,
  onVerify,
}: EndorseLockModalProps) {
  const theme = useTheme();

  if (!reason) return null;

  // Determine which CTA to show based on the lock reason
  const isAccountIssue = reason.includes('Create an account');
  const isVerificationIssue = !isAccountIssue;

  return (
    <Modal visible={visible} onDismiss={onDismiss} title="Endorsement Locked">
      <View style={styles.content}>
        <MaterialCommunityIcons
          name="lock-outline"
          size={48}
          color={theme.colors.outline}
          style={styles.icon}
        />
        <Text variant="bodyLarge" style={[styles.reason, { color: theme.colors.onSurface }]}>
          {reason}
        </Text>
        <View style={styles.actions}>
          {isAccountIssue ? (
            <Button mode="contained" onPress={onSignUp} style={styles.ctaButton}>
              Create Account
            </Button>
          ) : isVerificationIssue ? (
            <Button mode="contained" onPress={onVerify} style={styles.ctaButton}>
              Verify Identity
            </Button>
          ) : null}
          <Button mode="text" onPress={onDismiss}>
            Maybe Later
          </Button>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  icon: {
    marginBottom: 16,
  },
  reason: {
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  actions: {
    width: '100%',
    gap: 8,
  },
  ctaButton: {
    marginHorizontal: 16,
  },
});
```

### 5\. New Component: `src/components/feed/MassEndorseButton.tsx`

**Floating button for mass endorsement after filtering (Plans 02/05).**

Shown when a filter is active and there are candidates in the filtered list. Uses Plan 01's gating — requires account + full verification + district match.

Key changes from original plan:
- Gets `userId` from `useAuthStore` (not `useUserStore.userProfile`)
- `endorseCandidate` requires `(userId, candidateId)`

```tsx
import React, { useState } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { useAuthStore } from '@/stores';
import { useUserStore, selectFullyVerified, selectHasAccount, selectUserDistrictIds } from '@/stores';
import { ConfirmModal } from '@/components/ui/Modal';
import type { FeedItem } from '@/types';

interface MassEndorseButtonProps {
  filteredItems: FeedItem[];
  experienceFilter: string;
  style?: ViewStyle;
}

export default function MassEndorseButton({
  filteredItems,
  experienceFilter,
  style,
}: MassEndorseButtonProps) {
  const theme = useTheme();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isEndorsing, setIsEndorsing] = useState(false);

  // User ID from auth store (real-time)
  const userId = useAuthStore((s) => s.user?.id);

  // Selectors from user store (requires subscribeToProfile)
  const hasAccount = useUserStore(selectHasAccount);
  const fullyVerified = useUserStore(selectFullyVerified);
  const userDistrictIds = useUserStore(selectUserDistrictIds);
  const endorseCandidate = useUserStore((s) => s.endorseCandidate);
  const hasEndorsedCandidate = useUserStore((s) => s.hasEndorsedCandidate);

  // Only show when a non-random filter is active
  if (experienceFilter === 'random') return null;
  if (filteredItems.length === 0) return null;
  if (!userId || !hasAccount || !fullyVerified) return null;

  // Count endorsable candidates (in user's district, not already endorsed)
  const endorsableCandidates = filteredItems.filter((item) => {
    if (hasEndorsedCandidate(item.candidate.id)) return false;
    return userDistrictIds.includes(item.candidate.district);
  });

  if (endorsableCandidates.length === 0) return null;

  const handleMassEndorse = async () => {
    setIsEndorsing(true);
    for (const item of endorsableCandidates) {
      await endorseCandidate(userId, item.candidate.id);
    }
    setIsEndorsing(false);
    setShowConfirm(false);
  };

  return (
    <View style={[styles.container, style]}>
      <Button
        mode="contained"
        compact
        icon="heart-multiple"
        onPress={() => setShowConfirm(true)}
        style={styles.button}
        labelStyle={styles.label}
      >
        Endorse all {endorsableCandidates.length}
      </Button>

      <ConfirmModal
        visible={showConfirm}
        onDismiss={() => setShowConfirm(false)}
        onConfirm={handleMassEndorse}
        title="Mass Endorse"
        message={`Endorse ${endorsableCandidates.length} candidates matching your current filter?`}
        confirmLabel={isEndorsing ? 'Endorsing...' : 'Confirm'}
        loading={isEndorsing}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    zIndex: 100,
  },
  button: {
    borderRadius: 20,
  },
  label: {
    fontSize: 12,
    color: '#fff',
  },
});
```

### 6\. Update `src/components/ui/Badge.tsx` — Alignment color tiers

**Current tiers:**

```
80-100%: #4caf50 (green)
60-79%:  #8bc34a (light green)
40-59%:  #ff9800 (orange)
20-39%:  #ff5722 (deep orange)
0-19%:   #f44336 (red)
```

**New tiers (used anywhere the Badge component renders alignment):**

```
61-100%: #4caf50 (green)
31-60%:  #ffc107 (yellow/amber)
0-30%:   #ff9800 (orange)
```

```ts
// In Badge.tsx, update getAlignmentColor:
const getAlignmentColor = (score: number): string => {
  if (score >= 61) return '#4caf50'; // Green
  if (score >= 31) return '#ffc107'; // Yellow
  return '#ff9800';                  // Orange
};
```

This also affects the PSACard (kept for candidate profile page) — its alignment badge
will use the updated Badge component colors automatically.

### 7\. Update `src/utils/alignment.ts` — No algorithm changes needed

The alignment calculation logic stays the same. Only the visual representation (colors) changes. The existing `calculateAlignmentScore()` function returns 0-100, which the new color tiers map correctly.

---

## Files to Create

| File | Purpose |
| :---- | :---- |
| `src/components/feed/FullScreenPSA.tsx` | Full-screen video PSA with overlaid UI + photo fallback |
| `src/components/feed/AlignmentCircle.tsx` | Orange/yellow/green alignment badge (shows "?" for no-quiz users) |
| `src/components/feed/EndorseLockModal.tsx` | Modal explaining why endorsement is locked + CTA |
| `src/components/feed/ExperienceMenu.tsx` | Dropdown filter (see Plan 05) |
| `src/components/feed/QuizPromptCard.tsx` | Full-screen quiz CTA for no-quiz users (see Plan 06) |
| `src/components/feed/MassEndorseButton.tsx` | Floating mass endorsement button |

## Files to Modify

| File | Change |
| :---- | :---- |
| `app/_layout.tsx` | Add `subscribeToProfile` call so userStore selectors work |
| `src/types/index.ts` | Add `district: string` to `CandidatePreview` |
| `app/(tabs)/for-you.tsx` | Replace card FlatList with paging full-screen FlatList; add `district` to `generateFeedItem` |
| `src/components/ui/Badge.tsx` | Update alignment color tiers to orange/yellow/green (3 tiers) |
| `src/components/feed/index.ts` | Export new components |

## Files to Keep (not removed)

| File | Status |
| :---- | :---- |
| `src/components/feed/PSACard.tsx` | Keep for candidate profile page (`app/candidate/[id].tsx`), but no longer used in For You feed. Has tappable dealbreaker badge + modal showing matched dealbreakers with candidate positions. |

---

## Implementation Order

1. **Pre-requisites** (Steps 0a-0c): `_layout.tsx` subscription, type updates, `generateFeedItem` district
2. **Standalone components**: AlignmentCircle, EndorseLockModal
3. **Badge.tsx** color tier update
4. **FullScreenPSA** (depends on AlignmentCircle, EndorseLockModal)
5. **MassEndorseButton** (depends on types being updated)
6. **Stub components**: ExperienceMenu, QuizPromptCard (minimal stubs; full impl in Plans 05/06)
7. **for-you.tsx** complete rewrite (depends on all above)
8. **feed/index.ts** exports

---

## Swipe Behavior

| Gesture | Action |
| :---- | :---- |
| Swipe up | Next PSA |
| Swipe down | Previous PSA |
| Tap video | Play/Pause |
| Tap candidate avatar | Navigate to profile |
| Tap endorse button | Toggle endorsement (or show lock modal) |

Vertical swipe only — no horizontal swipe. The `pagingEnabled` prop on FlatList handles snap-to-page behavior natively. `snapToInterval={itemHeight}` ensures each swipe lands exactly on the next PSA.

---

## Performance Considerations

- **Video preloading:** Only the active PSA plays video; adjacent items are paused
- **getItemLayout:** Provided for O(1) scroll-to-index performance
- **Lazy rendering:** FlatList's `windowSize` and `maxToRenderPerBatch` control memory usage
- **Black background:** Consistent with TikTok/Reels dark theme for video content
- **Tab bar visible:** Bottom tab bar remains visible for navigation consistency
- **Photo fallback:** Candidates without video URLs show their photo (or generic avatar) as full-screen background with gradient overlay, avoiding broken/blank video states
- **Responsive dimensions:** Uses `useWindowDimensions()` hook instead of static `Dimensions.get('window')` for proper handling of rotation and window resizing

---

## Implementation Notes (2026-03-05)

Plan 04 was implemented as designed. All components listed above were created and integrated. The TikTok-style full-screen swipe feed, alignment circles, endorsement gating, and video/photo fallback all work correctly.

**Post-implementation bugs** were discovered during Plan 05 integration (experience filters). These are documented in `PLAN-05-experience-filters.md` under "Implementation Notes" and include:
- Portal touch-blocking from always-mounted modals (fixed with conditional rendering)
- Infinite re-render from `selectUserDistrictIds` in MassEndorseButton (fixed with local useMemo)
- Stable dependency management for useEffect/useMemo in for-you.tsx
