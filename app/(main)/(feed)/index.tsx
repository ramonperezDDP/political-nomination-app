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
  user: User | null,
  userIssues: string[],
  userDealbreakers: string[],
  issues: Array<{ id: string; name: string }>,
  userResponses: Array<{ issueId: string; answer: string | number | string[] }> = []
): FeedItem => {
  const candidatePriorityIssues = (candidate.topIssues || [])
    .filter((ti) => ti.priority <= 5)
    .sort((a, b) => a.priority - b.priority);
  const candidateIssueIds = candidatePriorityIssues.map((ti) => ti.issueId);
  const allPositions = candidate.topIssues || [];
  const { score, matchedIssues, hasDealbreaker, matchedDealbreakers } = calculateAlignmentScore({
    candidateIssues: candidateIssueIds,
    userIssues,
    candidatePositions: candidatePriorityIssues,
    userDealbreakers,
    allCandidatePositions: allPositions,
    userResponses,
  });

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
      district: candidate.district,
      zone: candidate.zone,
    },
    alignmentScore: score,
    matchedIssues,
    hasDealbreaker,
    matchedDealbreakers,
    candidatePositions: candidate.topIssues || [],
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
    canSeeAlignment ? 'issues' : 'random'
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
  const userDealbreakers = user?.dealbreakers;

  // Auto-switch to 'issues' when user completes quiz
  useEffect(() => {
    if (canSeeAlignment && experienceFilter === 'random') {
      setExperienceFilter('issues');
    }
  }, [canSeeAlignment]);

  useEffect(() => {
    const loadFeed = async () => {
      if (!issuesReady) return;
      setIsLoading(true);
      try {
        let candidatesData = await getCandidatesForFeed(selectedDistrict);
        if (candidatesData.length === 0 ||
            candidatesData.some(({ candidate }) => !candidate.zone)) {
          // Reseed if no candidates or if they lack zone data (Plan 05 migration)
          await reseedAllData();
          candidatesData = await getCandidatesForFeed(selectedDistrict);
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
  }, [issuesReady, userId, selectedDistrict]);

  // Apply experience filter — use stable references, not entire user object
  const filteredItems = useMemo(() => {
    switch (experienceFilter) {
      case 'issues':
        return feedItems.filter((item) => {
          if (item.matchedIssues.length === 0) return false;
          const responses = userResponses || [];
          return item.candidatePositions.some((cp) => {
            const userResponse = responses.find((r) => r.issueId === cp.issueId);
            if (!userResponse) return false;
            const userValue = Number(userResponse.answer);
            return (userValue >= 0 && cp.spectrumPosition >= 0) ||
                   (userValue < 0 && cp.spectrumPosition < 0);
          });
        });

      case 'most_important': {
        const dealbreakers = userDealbreakers || [];
        if (dealbreakers.length === 0) return feedItems;
        return feedItems.filter((item) => {
          for (const dealbreakerId of dealbreakers) {
            const response = (userResponses || []).find(
              (r) => r.issueId === dealbreakerId
            );
            if (!response) continue;
            const candidatePosition = item.candidatePositions.find(
              (cp) => cp.issueId === dealbreakerId
            );
            if (!candidatePosition) continue;
            const userValue = Number(response.answer);
            const candidateValue = candidatePosition.spectrumPosition;
            if ((userValue >= 0 && candidateValue < 0) ||
                (userValue < 0 && candidateValue >= 0)) {
              return false;
            }
          }
          return true;
        });
      }

      case 'location':
        if (!selectedLocation) return feedItems;
        return feedItems.filter((item) =>
          item.candidate.district === selectedLocation ||
          item.candidate.zone === selectedLocation
        );

      case 'random':
      default:
        return feedItems;
    }
  }, [feedItems, experienceFilter, selectedLocation, userResponses, userDealbreakers]);

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
        style={{ top: 48 }}
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
