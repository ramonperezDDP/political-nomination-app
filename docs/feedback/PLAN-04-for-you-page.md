# Plan 04: For You Page — TikTok-Style Rework

**Feedback:** Full-screen PSA videos one at a time (TikTok/Reels style), swipe to navigate. Alignment circle with orange/yellow/green colors. "Perfectly aligned" badge for 100% match. Experience dropdown menu.

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

Each PSA takes up the **entire screen**. User swipes vertically (or horizontally) to move between PSAs. Overlaid UI elements sit on top of the video.

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
│  @CandidateName                             │
│  "My position on Healthcare"                │
│                                  [♡ Endorse]│
│  🏷 Healthcare  🏷 Economy      [👤 Profile]│
│                                  [↗ Share]  │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Files to Modify

### 1. `app/(tabs)/for-you.tsx` — Complete layout rework

**Replace the current FlatList + PSACard layout with a paging FlatList:**

```tsx
import React, { useState, useCallback, useRef, useMemo } from 'react';
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
import { useUserStore, useConfigStore } from '@/stores';
import { getCandidatesForFeed } from '@/services/firebase/firestore';
import { calculateAlignmentScore } from '@/utils/alignment';
import FullScreenPSA from '@/components/feed/FullScreenPSA';
import ExperienceMenu from '@/components/feed/ExperienceMenu';
import QuizPromptCard from '@/components/feed/QuizPromptCard';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

type ExperienceFilter = 'random' | 'issues' | 'most_important' | 'location';

export default function ForYouScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const user = useUserStore((s) => s.userProfile);
  const hasCompletedQuiz = useUserStore((s) =>
    (s.userProfile?.questionnaireResponses?.length || 0) > 0
  );

  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [experienceFilter, setExperienceFilter] = useState<ExperienceFilter>(
    hasCompletedQuiz ? 'issues' : 'random'
  );

  // ... data fetching logic (similar to current, loads candidates + computes alignment)

  // Apply experience filter
  const filteredItems = useMemo(() => {
    switch (experienceFilter) {
      case 'issues':
        // Show PNs matching any shared policy position
        return feedItems.filter((item) => item.matchedIssues.length > 0);
      case 'most_important':
        // Show only PNs matching user's dealbreaker/must-match issues
        return feedItems.filter((item) => {
          const userDealbreakers = user?.dealbreakers || [];
          return item.matchedIssues.some((id) => userDealbreakers.includes(id));
        });
      case 'location':
        // Filter by selected location (handled by location modal)
        return feedItems; // Filtered separately
      case 'random':
      default:
        // Shuffle all items
        return [...feedItems].sort(() => Math.random() - 0.5);
    }
  }, [feedItems, experienceFilter, user?.dealbreakers]);

  // Paging FlatList item height = full screen
  const itemHeight = SCREEN_HEIGHT - insets.bottom; // Account for tab bar

  // Prepend quiz prompt if user hasn't completed quiz
  const displayItems = hasCompletedQuiz
    ? filteredItems
    : [{ id: 'quiz-prompt', type: 'prompt' }, ...filteredItems];

  return (
    <View style={[styles.container, { backgroundColor: '#000' }]}>
      <StatusBar barStyle="light-content" />

      {/* Experience dropdown - positioned absolutely */}
      <ExperienceMenu
        selectedFilter={experienceFilter}
        onFilterChange={setExperienceFilter}
        hasCompletedQuiz={hasCompletedQuiz}
        style={[styles.experienceMenu, { top: insets.top + 8 }]}
      />

      {/* Full-screen paging list */}
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

### 2. New Component: `src/components/feed/FullScreenPSA.tsx`

**Replaces PSACard with a full-screen video + overlaid controls:**

```tsx
import React, { useRef, useState } from 'react';
import { View, Pressable, StyleSheet, Dimensions } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { Video, ResizeMode } from 'expo-av';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useUserStore } from '@/stores';
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

  const hasEndorsed = useUserStore((s) => s.hasEndorsedCandidate(candidate.id));
  const endorseCandidate = useUserStore((s) => s.endorseCandidate);
  const revokeEndorsement = useUserStore((s) => s.revokeEndorsement);

  return (
    <View style={[styles.container, { height }]}>
      {/* Full-screen video background */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => setIsPaused((p) => !p)}
      >
        {psa.videoUrl ? (
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
          <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
            <MaterialCommunityIcons name="video" size={64} color="#555" />
          </View>
        )}
      </Pressable>

      {/* Gradient overlay at bottom for readability */}
      <View style={styles.bottomGradient} pointerEvents="none" />

      {/* Alignment circle — top left */}
      <AlignmentCircle
        score={alignmentScore}
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
        <Pressable
          onPress={() => {
            if (hasEndorsed) revokeEndorsement(candidate.id);
            else endorseCandidate(candidate.id);
          }}
          style={styles.actionButton}
        >
          <MaterialCommunityIcons
            name={hasEndorsed ? 'heart' : 'heart-outline'}
            size={32}
            color={hasEndorsed ? '#de482e' : '#fff'}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    backgroundColor: '#000',
    position: 'relative',
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
    // Use a semi-transparent black; for a real gradient use expo-linear-gradient
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
    right: 80, // Leave space for right-side buttons
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

### 3. New Component: `src/components/feed/AlignmentCircle.tsx`

**Alignment circle with updated colors: orange/yellow/green.**

```tsx
import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface AlignmentCircleProps {
  score: number;
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

### 4. Update `src/components/ui/Badge.tsx` — Alignment color tiers

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

```typescript
// In Badge.tsx, update getAlignmentColor:
const getAlignmentColor = (score: number): string => {
  if (score >= 61) return '#4caf50'; // Green
  if (score >= 31) return '#ffc107'; // Yellow
  return '#ff9800';                  // Orange
};
```

### 5. Update `src/utils/alignment.ts` — No algorithm changes needed

The alignment calculation logic stays the same. Only the visual representation (colors) changes. The existing `calculateAlignmentScore()` function returns 0-100, which the new color tiers map correctly.

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/feed/FullScreenPSA.tsx` | Full-screen video PSA with overlaid UI |
| `src/components/feed/AlignmentCircle.tsx` | Orange/yellow/green alignment badge |
| `src/components/feed/ExperienceMenu.tsx` | Dropdown filter (see Plan 05) |
| `src/components/feed/QuizPromptCard.tsx` | Full-screen quiz CTA for no-quiz users (see Plan 06) |

## Files to Modify

| File | Change |
|------|--------|
| `app/(tabs)/for-you.tsx` | Replace card FlatList with paging full-screen FlatList |
| `src/components/ui/Badge.tsx` | Update alignment color tiers to orange/yellow/green |
| `src/components/feed/index.ts` | Export new components |

## Files to Remove/Deprecate

| File | Status |
|------|--------|
| `src/components/feed/PSACard.tsx` | Keep for now (used on candidate profile), but no longer used in For You feed |

---

## Swipe Behavior

| Gesture | Action |
|---------|--------|
| Swipe up | Next PSA |
| Swipe down | Previous PSA |
| Tap video | Play/Pause |
| Tap candidate avatar | Navigate to profile |
| Tap endorse button | Toggle endorsement |

The `pagingEnabled` prop on FlatList handles snap-to-page behavior natively. `snapToInterval={itemHeight}` ensures each swipe lands exactly on the next PSA.

---

## Performance Considerations

- **Video preloading:** Only the active PSA plays video; adjacent items are paused
- **getItemLayout:** Provided for O(1) scroll-to-index performance
- **Lazy rendering:** FlatList's `windowSize` and `maxToRenderPerBatch` control memory usage
- **Black background:** Consistent with TikTok/Reels dark theme for video content

---

## Open Questions

1. **Tab bar visibility:** Should the bottom tab bar remain visible over the full-screen video, or hide on scroll (like TikTok)? Recommend: keep visible for navigation consistency.
2. **Horizontal swipe:** Feedback mentions "left/right" swipe too — should this navigate between PSAs or trigger a different action (e.g., swipe right to endorse)?
3. **Video placeholder:** If a candidate has no video, show a static image with their position text overlay?
