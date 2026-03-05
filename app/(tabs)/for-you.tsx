import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  Platform,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore, useConfigStore } from '@/stores';
import { useUserStore, selectCanSeeAlignment } from '@/stores';
import { getCandidatesForFeed, reseedAllData, inferGenderFromName } from '@/services/firebase/firestore';
import { calculateAlignmentScore } from '@/utils/alignment';
import FullScreenPSA from '@/components/feed/FullScreenPSA';
import ExperienceMenu from '@/components/feed/ExperienceMenu';
import QuizPromptCard from '@/components/feed/QuizPromptCard';
import MassEndorseButton from '@/components/feed/MassEndorseButton';
import { LoadingScreen } from '@/components/ui';
import type { FeedItem, Candidate, User } from '@/types';

type ExperienceFilter = 'random' | 'issues' | 'most_important' | 'location';

type DisplayItem =
  | (FeedItem & { type?: 'candidate' })
  | { id: string; type: 'prompt' };

// Generate feed item from candidate data
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
    },
    alignmentScore: score,
    matchedIssues,
    hasDealbreaker,
    matchedDealbreakers,
    candidatePositions: candidate.topIssues || [],
  };
};

export default function ForYouScreen() {
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const { user } = useAuthStore();
  const { issues } = useConfigStore();
  const canSeeAlignment = useUserStore(selectCanSeeAlignment);

  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [experienceFilter, setExperienceFilter] = useState<ExperienceFilter>(
    canSeeAlignment ? 'issues' : 'random'
  );

  // Auto-switch to 'issues' when user completes quiz
  useEffect(() => {
    if (canSeeAlignment && experienceFilter === 'random') {
      setExperienceFilter('issues');
    }
  }, [canSeeAlignment]);

  // Data fetching
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

  // Apply experience filter
  const filteredItems = useMemo(() => {
    switch (experienceFilter) {
      case 'issues':
        return feedItems.filter((item) => item.matchedIssues.length > 0);
      case 'most_important':
        return feedItems.filter((item) => !item.hasDealbreaker);
      case 'location':
        return feedItems;
      case 'random':
      default:
        return [...feedItems].sort(() => Math.random() - 0.5);
    }
  }, [feedItems, experienceFilter]);

  // Item height = full screen minus tab bar
  const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 49 + insets.bottom : 56;
  const itemHeight = screenHeight - TAB_BAR_HEIGHT;

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

  if (isLoading) {
    return <LoadingScreen message="Loading your feed..." />;
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Experience dropdown */}
      <ExperienceMenu
        selectedFilter={experienceFilter}
        onFilterChange={setExperienceFilter}
        style={{ top: insets.top + 8 }}
      />

      {/* Mass Endorse button */}
      <MassEndorseButton
        filteredItems={filteredItems}
        experienceFilter={experienceFilter}
        style={{ top: insets.top + 48 }}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});
