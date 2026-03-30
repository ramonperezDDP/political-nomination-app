import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  Platform,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore, useConfigStore } from '@/stores';
import { useUserStore, selectCanSeeAlignment, selectBrowsingDistrict } from '@/stores';
import { getCandidatesForFeed, reseedAllData, inferGenderFromName } from '@/services/firebase/firestore';
import { calculateAlignmentScore } from '@/utils/alignment';
import FullScreenPSA from '@/components/feed/FullScreenPSA';
import ExperienceMenu from '@/components/feed/ExperienceMenu';
import type { ExperienceFilter } from '@/components/feed/ExperienceMenu';
import QuizPromptCard from '@/components/feed/QuizPromptCard';
import MassEndorseButton from '@/components/feed/MassEndorseButton';
import LocationMapModal from '@/components/feed/LocationMapModal';
import { LoadingScreen } from '@/components/ui';
import type { FeedItem, Candidate, User } from '@/types';

type DisplayItem =
  | (FeedItem & { type?: 'candidate' })
  | { id: string; type: 'prompt' };

const generateFeedItem = (
  candidate: Candidate,
  candidateUser: User | null,
  issues: Array<{ id: string; name: string }>,
  currentUserResponses: Array<{ questionId: string; issueId: string; answer: number }> = []
): FeedItem => {
  // Normalize candidate's quiz responses to numeric answers
  const candidateResponses = (candidateUser?.questionnaireResponses || [])
    .map((r) => ({ questionId: r.questionId, issueId: r.issueId, answer: Number(r.answer) }))
    .filter((r) => !isNaN(r.answer));

  const { score, sharedCount, alignedQuestionIds, exactMatchIds, closeMatchIds, notMatchedIds } = calculateAlignmentScore({
    candidateResponses,
    userResponses: currentUserResponses,
  });

  const candidateIssueIds = (candidate.topIssues || [])
    .filter((ti) => ti.priority <= 5)
    .sort((a, b) => a.priority - b.priority)
    .map((ti) => ti.issueId);

  return {
    id: candidate.id,
    psa: {
      id: `psa-${candidate.id}`,
      candidateId: candidate.id,
      title: candidate.topIssues?.[0]
        ? `My Position on ${issues.find((i) => i.id === candidate.topIssues[0].issueId)?.name || 'Key Issues'}`
        : 'Meet the Candidate',
      description: candidate.reasonForRunning || 'Learn about this candidate\'s platform',
      videoUrl: '',
      thumbnailUrl: '',
      duration: 60,
      status: 'published',
      issueIds: candidateIssueIds,
      views: candidate.profileViews || 0,
      likes: Math.floor((candidate.endorsementCount || 0) * 0.7),
      createdAt: candidate.createdAt,
      updatedAt: candidate.updatedAt,
    },
    candidate: {
      id: candidate.id,
      displayName: candidateUser?.displayName || 'Candidate',
      photoUrl: candidateUser?.photoUrl,
      gender: candidateUser?.gender || inferGenderFromName(candidateUser?.displayName || ''),
      topIssues: candidateIssueIds.slice(0, 3).map(
        (id) => issues.find((i) => i.id === id)?.name || id
      ),
      endorsementCount: candidate.endorsementCount || 0,
      averageSpectrum: candidate.topIssues?.length
        ? Math.round(candidate.topIssues.reduce((sum, i) => sum + i.spectrumPosition, 0) / candidate.topIssues.length)
        : 0,
      district: candidate.district,
      zone: candidate.zone,
    },
    alignmentScore: score,
    candidateResponses,
    sharedCount,
    alignedQuestionIds,
    exactMatchIds,
    closeMatchIds,
    notMatchedIds,
  };
};

export default function ForYouScreen() {
  const isWeb = Platform.OS === 'web';
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();

  const { user } = useAuthStore();
  const userId = user?.id;
  const { issues } = useConfigStore();
  const issuesReady = issues.length > 0;
  const canSeeAlignment = useUserStore(selectCanSeeAlignment);
  const selectedDistrict = useUserStore(selectBrowsingDistrict);

  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [experienceFilter, setExperienceFilter] = useState<ExperienceFilter>(
    canSeeAlignment ? 'issues' : 'location'
  );
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);

  // On web, useWindowDimensions returns the browser window size, not the phone frame.
  // Measure the actual container height via onLayout so FlatList items fit correctly.
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const onContainerLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0 && h !== measuredHeight) setMeasuredHeight(h);
  }, [measuredHeight]);

  // Stable user data for filters (avoid depending on entire user object)
  const userResponses = user?.questionnaireResponses;

  // Auto-switch to 'issues' when user completes quiz
  useEffect(() => {
    if (canSeeAlignment && experienceFilter === 'location') {
      setExperienceFilter('issues');
    }
  }, [canSeeAlignment]);

  useEffect(() => {
    const loadFeed = async () => {
      if (!issuesReady) return;
      setIsLoading(true);
      try {
        let candidatesData = await getCandidatesForFeed(selectedDistrict);
        const needsReseed = candidatesData.length === 0 ||
          candidatesData.some(({ candidate }) => !candidate.zone) ||
          candidatesData.some(({ candidate }) =>
            candidate.district === 'PA-02' &&
            candidate.topIssues?.some((ti: any) => ti.issueId === 'pa01-infrastructure')
          );
        if (needsReseed) {
          await reseedAllData();
          candidatesData = await getCandidatesForFeed(selectedDistrict);
        }
        // Normalize current user's quiz responses to numeric answers for alignment
        const normalizedUserResponses = (user?.questionnaireResponses || [])
          .map((r) => ({ questionId: r.questionId, issueId: r.issueId, answer: Number(r.answer) }))
          .filter((r) => !isNaN(r.answer));
        // Filter out eliminated candidates
        const activeCandidates = candidatesData.filter(
          ({ candidate }) => candidate.contestStatus !== 'eliminated'
        );
        const items = activeCandidates.map(({ candidate, user: candidateUser }) =>
          generateFeedItem(candidate, candidateUser, issues, normalizedUserResponses)
        );
        setFeedItems(items);
      } catch (error) {
        console.warn('Error loading feed:', error);
      }
      setIsLoading(false);
    };
    loadFeed();
  }, [issuesReady, userId, selectedDistrict]);

  // Apply experience filter — use stable references, not entire user object
  const filteredItems = useMemo(() => {
    switch (experienceFilter) {
      case 'issues': {
        // Show candidates sorted by alignment score (best matches first).
        // Include candidates with null scores at the end (no shared quiz answers yet).
        const withScore = feedItems.filter((item) => item.alignmentScore != null);
        const withoutScore = feedItems.filter((item) => item.alignmentScore == null);
        return [
          ...withScore.sort((a, b) => (b.alignmentScore ?? 0) - (a.alignmentScore ?? 0)),
          ...withoutScore,
        ];
      }

      case 'location':
        if (!selectedLocation) return feedItems;
        return feedItems.filter((item) =>
          item.candidate.district === selectedLocation ||
          item.candidate.zone === selectedLocation
        );

      default:
        return feedItems;
    }
  }, [feedItems, experienceFilter, selectedLocation, userResponses]);

  // On native: full screen minus tab bar minus AppHeader.
  // AppHeader height ≈ safeAreaTop + paddingTop(8) + content(36) + paddingBottom(8) + border(1) = insets.top + 53
  const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 49 + insets.bottom : 56;
  const APP_HEADER_HEIGHT = insets.top + 53;
  const itemHeight = isWeb ? measuredHeight : screenHeight - TAB_BAR_HEIGHT - APP_HEADER_HEIGHT;

  // Prepend quiz prompt if user hasn't completed quiz
  const displayItems: DisplayItem[] = useMemo(() => {
    if (!canSeeAlignment) {
      return [
        { id: 'quiz-prompt', type: 'prompt' as const },
        ...filteredItems,
      ];
    }
    return filteredItems;
  }, [filteredItems, canSeeAlignment]);

  // On web, wait for container measurement before rendering the FlatList
  if (isLoading || (isWeb && measuredHeight === 0)) {
    return (
      <View style={styles.container} onLayout={onContainerLayout}>
        <LoadingScreen message="Loading your feed..." />
      </View>
    );
  }

  return (
    <View style={styles.container} onLayout={onContainerLayout}>
      {!isWeb && <StatusBar barStyle="light-content" />}

      <ExperienceMenu
        selectedFilter={experienceFilter}
        onFilterChange={setExperienceFilter}
        onLocationPress={() => setLocationModalVisible(true)}
        style={{ top: 8 }}
      />

      <MassEndorseButton
        filteredItems={filteredItems}
        experienceFilter={experienceFilter}
        style={{ top: 4 }}
      />

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
        onMomentumScrollEnd={(e) => {
          const newIndex = Math.round(
            e.nativeEvent.contentOffset.y / itemHeight
          );
          setActiveIndex(newIndex);
        }}
        onScroll={isWeb ? (e) => {
          // On web, onMomentumScrollEnd may not fire reliably.
          // Track scroll position via onScroll instead.
          const newIndex = Math.round(
            e.nativeEvent.contentOffset.y / itemHeight
          );
          if (newIndex !== activeIndex) setActiveIndex(newIndex);
        } : undefined}
        getItemLayout={(_, index) => ({
          length: itemHeight,
          offset: itemHeight * index,
          index,
        })}
      />

      {locationModalVisible && (
        <LocationMapModal
          visible={locationModalVisible}
          onDismiss={() => setLocationModalVisible(false)}
          onLocationSelect={(zoneId) => {
            setSelectedLocation(zoneId);
            setExperienceFilter('location');
          }}
          district={selectedDistrict}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});
