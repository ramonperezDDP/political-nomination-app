# Plan 04: For You Page — TikTok-Style Rework

**Feedback:** Full-screen PSA videos one at a time (TikTok/Reels style), vertical swipe only. Alignment circle with orange/yellow/green colors. "Perfectly aligned" badge for 100% match. Experience dropdown menu (Plan 05). Tab bar remains visible. All PNs are required to have PSAs. Mass endorsement after filtering (Plans 02/05).

---

## Current State

### `app/(tabs)/for-you.tsx`

- Vertical `FlatList` of `PSACard` components (card-based, not full-screen)
- Search bar at top with autocomplete
- Issue pills for filtering (horizontal scroll)
- Filter menu: All Candidates, High Alignment (80%+), No Dealbreakers, My Community

### `src/components/feed/PSACard.tsx`

- Card layout: 180px video + info section below
- Alignment badge (top-right of video): 48×48px circle
- Colors: green (80-100%), light-green (60-79%), orange (40-59%), deep-orange (20-39%), red (0-19%)
- Shows candidate name, stats, matched issues, endorse/share/profile buttons

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

## Files to Modify

### 1\. `app/(tabs)/for-you.tsx` — Complete layout rework

**Replace the current FlatList + PSACard layout with a paging FlatList:**

```
import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  View,
  FlatList,
  Dimensions,
  StyleSheet,
  Platform,
  StatusBar,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUserStore, useConfigStore, selectCanSeeAlignment, selectHasAccount } from '@/stores';
import { getCandidatesForFeed } from '@/services/firebase/firestore';
import { calculateAlignmentScore } from '@/utils/alignment';
import FullScreenPSA from '@/components/feed/FullScreenPSA';
import ExperienceMenu from '@/components/feed/ExperienceMenu';
import QuizPromptCard from '@/components/feed/QuizPromptCard';
import MassEndorseButton from '@/components/feed/MassEndorseButton';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

type ExperienceFilter = 'random' | 'issues' | 'most_important' | 'location';

export default function ForYouScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const user = useUserStore((s) => s.userProfile);
  const canSeeAlignment = useUserStore(selectCanSeeAlignment);

  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [experienceFilter, setExperienceFilter] = useState<ExperienceFilter>(
    canSeeAlignment ? 'issues' : 'random'
  );

  // Auto-switch to 'issues' when user completes quiz minimum while app is open (Plan 06)
  useEffect(() => {
    if (canSeeAlignment && experienceFilter === 'random') {
      setExperienceFilter('issues');
    }
  }, [canSeeAlignment]);

  // ... data fetching logic (loads candidates + computes alignment)

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
  const itemHeight = SCREEN_HEIGHT - insets.bottom;

  // Prepend quiz prompt if user hasn't completed quiz (Plan 06)
  const displayItems = useMemo(() => {
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
              feedItem={item}
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

The alignment circle shows "?" for users who haven't completed the quiz (per Plan 01 gating). The endorse button uses `selectEndorseLockReason` from Plan 01 to show appropriate lock state for anonymous users, unverified users, or wrong-district users.

```
import React, { useRef, useState } from 'react';
import { View, Pressable, StyleSheet, Dimensions } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { Video, ResizeMode } from 'expo-av';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useUserStore, selectCanSeeAlignment, selectEndorseLockReason, selectHasAccount } from '@/stores';
import AlignmentCircle from './AlignmentCircle';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface FullScreenPSAProps {
  feedItem: FeedItem;
  isActive: boolean;
  height: number;
}

export default function FullScreenPSA({ feedItem, isActive, height }: FullScreenPSAProps) {
  const theme = useTheme();
  const router = useRouter();
  const videoRef = useRef<Video>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const { candidate, psa, alignmentScore, matchedIssues, hasDealbreaker } = feedItem;

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
    if (hasEndorsed) revokeEndorsement(candidate.id);
    else endorseCandidate(candidate.id);
  };

  return (
    <View style={[styles.container, { height }]}>
      {/* Full-screen video background */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => setIsPaused((p) => !p)}
      >
        <Video
          ref={videoRef}
          source={{ uri: psa.videoUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode={ResizeMode.COVER}
          shouldPlay={isActive && !isPaused}
          isLooping
          isMuted={isMuted}
        />
      </Pressable>

      {/* Gradient overlay at bottom for readability */}
      <View style={styles.bottomGradient} pointerEvents="none" />

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

        {/* Mute toggle */}
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
      {showLockModal && (
        <EndorseLockModal
          reason={lockReason}
          hasAccount={hasAccount}
          onDismiss={() => setShowLockModal(false)}
          onSignUp={() => router.push('/(auth)/register')}
          onVerify={() => router.push('/(auth)/verify-identity')}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    backgroundColor: '#000',
    position: 'relative',
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  alignmentCircle: {
    position: 'absolute',
    top: 16,
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

```
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

### 4\. New Component: `src/components/feed/MassEndorseButton.tsx`

**Floating button for mass endorsement after filtering (Plans 02/05).**

Shown when a filter is active and there are candidates in the filtered list. Uses Plan 01's gating — requires account + full verification + district match.

```
import React, { useState } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { useUserStore, selectFullyVerified, selectHasAccount, selectUserDistrictIds } from '@/stores';
import { ConfirmModal } from '@/components/ui/Modal';

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

  const hasAccount = useUserStore(selectHasAccount);
  const fullyVerified = useUserStore(selectFullyVerified);
  const userDistrictIds = useUserStore(selectUserDistrictIds);
  const endorseCandidate = useUserStore((s) => s.endorseCandidate);
  const hasEndorsedCandidate = useUserStore((s) => s.hasEndorsedCandidate);
  const user = useUserStore((s) => s.userProfile);

  // Only show when a non-random filter is active
  if (experienceFilter === 'random') return null;
  if (filteredItems.length === 0) return null;

  // Count endorsable candidates (in user's district, not already endorsed)
  const endorsableCandidates = filteredItems.filter((item) => {
    if (hasEndorsedCandidate(item.candidate.id)) return false;
    return userDistrictIds.includes(item.candidate.district);
  });

  if (endorsableCandidates.length === 0) return null;
  if (!hasAccount || !fullyVerified) return null;

  const handleMassEndorse = async () => {
    setIsEndorsing(true);
    for (const item of endorsableCandidates) {
      await endorseCandidate(user!.id, item.candidate.id);
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

### 5\. Update `src/components/ui/Badge.tsx` — Alignment color tiers

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

### 6\. Update `src/utils/alignment.ts` — No algorithm changes needed

The alignment calculation logic stays the same. Only the visual representation (colors) changes. The existing `calculateAlignmentScore()` function returns 0-100, which the new color tiers map correctly.

---

## Files to Create

| File | Purpose |
| :---- | :---- |
| `src/components/feed/FullScreenPSA.tsx` | Full-screen video PSA with overlaid UI |
| `src/components/feed/AlignmentCircle.tsx` | Orange/yellow/green alignment badge (shows "?" for no-quiz users) |
| `src/components/feed/ExperienceMenu.tsx` | Dropdown filter (see Plan 05) |
| `src/components/feed/QuizPromptCard.tsx` | Full-screen quiz CTA for no-quiz users (see Plan 06) |
| `src/components/feed/MassEndorseButton.tsx` | Floating mass endorsement button |
| `src/components/feed/EndorseLockModal.tsx` | Modal explaining why endorsement is locked |

## Files to Modify

| File | Change |
| :---- | :---- |
| `app/(tabs)/for-you.tsx` | Replace card FlatList with paging full-screen FlatList, vertical swipe only |
| `src/components/ui/Badge.tsx` | Update alignment color tiers to orange/yellow/green |
| `src/components/feed/index.ts` | Export new components |

## Files to Keep (not removed)

| File | Status |
| :---- | :---- |
| `src/components/feed/PSACard.tsx` | Keep for candidate profile page (`app/candidate/[id].tsx`), but no longer used in For You feed |

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
