import React, { useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Dimensions,
  FlatList,
  ViewToken,
} from 'react-native';
import { Text, useTheme, Menu, Divider, IconButton } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuthStore, useUserStore, useConfigStore } from '@/stores';
import PSACard from '@/components/feed/PSACard';
import { EmptyState, LoadingScreen } from '@/components/ui';
import type { FeedItem } from '@/types';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_HEIGHT = SCREEN_HEIGHT - 180; // Account for tab bar and header

// Mock feed data for demonstration
const MOCK_FEED: FeedItem[] = [
  {
    id: '1',
    psa: {
      id: 'psa1',
      candidateId: 'c1',
      title: 'My Vision for Healthcare',
      description: 'Explaining my comprehensive healthcare plan',
      videoUrl: '',
      thumbnailUrl: '',
      duration: 60,
      status: 'published',
      issueIds: ['healthcare'],
      views: 12500,
      likes: 890,
      createdAt: {} as any,
      updatedAt: {} as any,
    },
    candidate: {
      id: 'c1',
      displayName: 'Jane Smith',
      photoUrl: undefined,
      topIssues: ['Healthcare', 'Education', 'Climate'],
      endorsementCount: 1250,
    },
    alignmentScore: 85,
    matchedIssues: ['healthcare', 'education'],
    hasDealbreaker: false,
  },
  {
    id: '2',
    psa: {
      id: 'psa2',
      candidateId: 'c2',
      title: 'Economic Growth Plan',
      description: 'How we can strengthen our economy',
      videoUrl: '',
      thumbnailUrl: '',
      duration: 45,
      status: 'published',
      issueIds: ['economy'],
      views: 8900,
      likes: 654,
      createdAt: {} as any,
      updatedAt: {} as any,
    },
    candidate: {
      id: 'c2',
      displayName: 'John Doe',
      photoUrl: undefined,
      topIssues: ['Economy', 'Jobs', 'Infrastructure'],
      endorsementCount: 980,
    },
    alignmentScore: 72,
    matchedIssues: ['economy'],
    hasDealbreaker: false,
  },
  {
    id: '3',
    psa: {
      id: 'psa3',
      candidateId: 'c3',
      title: 'Climate Action Now',
      description: 'My plan to address climate change',
      videoUrl: '',
      thumbnailUrl: '',
      duration: 90,
      status: 'published',
      issueIds: ['climate'],
      views: 15200,
      likes: 1120,
      createdAt: {} as any,
      updatedAt: {} as any,
    },
    candidate: {
      id: 'c3',
      displayName: 'Sarah Johnson',
      photoUrl: undefined,
      topIssues: ['Climate', 'Environment', 'Energy'],
      endorsementCount: 1560,
    },
    alignmentScore: 91,
    matchedIssues: ['climate', 'environment'],
    hasDealbreaker: true,
  },
];

type FilterType = 'all' | 'high-alignment' | 'community' | 'no-dealbreakers';

export default function ForYouScreen() {
  const theme = useTheme();
  const { issues } = useConfigStore();
  const { userProfile } = useUserStore();

  const [feedItems] = useState<FeedItem[]>(MOCK_FEED);
  const [isLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [filterMenuVisible, setFilterMenuVisible] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all');
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) {
        setActiveIndex(viewableItems[0].index || 0);
      }
    },
    []
  );

  const viewabilityConfig = {
    itemVisiblePercentThreshold: 50,
  };

  const getFilteredFeed = () => {
    let filtered = feedItems;

    switch (selectedFilter) {
      case 'high-alignment':
        filtered = filtered.filter((item) => item.alignmentScore >= 80);
        break;
      case 'no-dealbreakers':
        filtered = filtered.filter((item) => !item.hasDealbreaker);
        break;
      case 'community':
        // In production, this would filter by community/district
        break;
    }

    if (selectedIssue) {
      filtered = filtered.filter((item) =>
        item.matchedIssues.includes(selectedIssue)
      );
    }

    return filtered;
  };

  const filteredFeed = getFilteredFeed();

  const renderPSACard = ({ item, index }: { item: FeedItem; index: number }) => (
    <PSACard
      feedItem={item}
      isActive={index === activeIndex}
      cardHeight={CARD_HEIGHT}
    />
  );

  if (isLoading) {
    return <LoadingScreen message="Loading your feed..." />;
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top']}
    >
      {/* Filter Header */}
      <View style={styles.header}>
        <Text variant="titleLarge" style={styles.title}>
          For You
        </Text>
        <View style={styles.filterRow}>
          <Menu
            visible={filterMenuVisible}
            onDismiss={() => setFilterMenuVisible(false)}
            anchor={
              <IconButton
                icon="filter-variant"
                onPress={() => setFilterMenuVisible(true)}
              />
            }
          >
            <Menu.Item
              onPress={() => {
                setSelectedFilter('all');
                setFilterMenuVisible(false);
              }}
              title="All Candidates"
              leadingIcon={selectedFilter === 'all' ? 'check' : undefined}
            />
            <Menu.Item
              onPress={() => {
                setSelectedFilter('high-alignment');
                setFilterMenuVisible(false);
              }}
              title="High Alignment (80%+)"
              leadingIcon={selectedFilter === 'high-alignment' ? 'check' : undefined}
            />
            <Menu.Item
              onPress={() => {
                setSelectedFilter('no-dealbreakers');
                setFilterMenuVisible(false);
              }}
              title="No Dealbreakers"
              leadingIcon={selectedFilter === 'no-dealbreakers' ? 'check' : undefined}
            />
            <Divider />
            <Menu.Item
              onPress={() => {
                setSelectedFilter('community');
                setFilterMenuVisible(false);
              }}
              title="My Community"
              leadingIcon={selectedFilter === 'community' ? 'check' : undefined}
            />
          </Menu>
        </View>
      </View>

      {/* Issue Pills */}
      <FlatList
        horizontal
        data={userProfile?.selectedIssues || []}
        renderItem={({ item }) => {
          const issue = issues.find((i) => i.id === item);
          const isSelected = selectedIssue === item;
          return (
            <View
              style={[
                styles.issuePill,
                {
                  backgroundColor: isSelected
                    ? theme.colors.primary
                    : theme.colors.surfaceVariant,
                },
              ]}
            >
              <Text
                variant="labelMedium"
                style={{ color: isSelected ? '#fff' : theme.colors.onSurfaceVariant }}
                onPress={() => setSelectedIssue(isSelected ? null : item)}
              >
                {issue?.name || item}
              </Text>
            </View>
          );
        }}
        keyExtractor={(item) => item}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.issuePillsContainer}
      />

      {/* Feed */}
      {filteredFeed.length === 0 ? (
        <EmptyState
          icon="video-off"
          title="No PSAs found"
          message="Try adjusting your filters or check back later for new content"
          actionLabel="Reset Filters"
          onAction={() => {
            setSelectedFilter('all');
            setSelectedIssue(null);
          }}
        />
      ) : (
        <FlatList
          ref={flatListRef}
          data={filteredFeed}
          renderItem={renderPSACard}
          keyExtractor={(item) => item.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={CARD_HEIGHT + 16}
          decelerationRate="fast"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          contentContainerStyle={styles.feedContent}
          getItemLayout={(_, index) => ({
            length: CARD_HEIGHT + 16,
            offset: (CARD_HEIGHT + 16) * index,
            index,
          })}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  title: {
    fontWeight: 'bold',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  issuePillsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  issuePill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  feedContent: {
    padding: 16,
    paddingTop: 0,
  },
});
