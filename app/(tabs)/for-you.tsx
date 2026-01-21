import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  Alert,
  Pressable,
  PixelRatio,
  Keyboard,
} from 'react-native';
import { Text, useTheme, Menu, Divider, IconButton, TouchableRipple } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuthStore, useConfigStore } from '@/stores';
import { getCandidatesForFeed, reseedAllData } from '@/services/firebase/firestore';
import PSACard from '@/components/feed/PSACard';
import { EmptyState, LoadingScreen, SearchInput } from '@/components/ui';
import type { FeedItem, Candidate, User } from '@/types';


type FilterType = 'all' | 'high-alignment' | 'community' | 'no-dealbreakers';

// Calculate alignment score based on matching issues
const calculateAlignmentScore = (
  candidateIssues: string[],
  userIssues: string[],
  candidatePositions: Array<{ issueId: string; spectrumPosition: number }>,
  userDealbreakers: string[]
): { score: number; matchedIssues: string[]; hasDealbreaker: boolean } => {
  const matchedIssues = candidateIssues.filter((id) => userIssues.includes(id));
  const matchRatio = userIssues.length > 0 ? matchedIssues.length / userIssues.length : 0;

  // Check for dealbreakers (issues where candidate has extreme opposite position)
  const hasDealbreaker = userDealbreakers.some((dealbreaker) => {
    const position = candidatePositions.find((p) => p.issueId === dealbreaker);
    // This is simplified - in production you'd compare user preference vs candidate position
    return position && Math.abs(position.spectrumPosition) > 80;
  });

  // Calculate score based on:
  // - Base score of 40
  // - 12 points per matching issue (rewards actual overlap)
  // - Up to 25 points based on match ratio (rewards percentage coverage)
  // - Small random variance for variety
  const matchBonus = matchedIssues.length * 12;
  const ratioBonus = matchRatio * 25;
  const randomVariance = Math.random() * 8;
  const baseScore = Math.round(40 + matchBonus + ratioBonus + randomVariance);

  return {
    score: Math.min(100, Math.max(0, baseScore)),
    matchedIssues,
    hasDealbreaker,
  };
};

// Generate feed item from candidate data
const generateFeedItem = (
  candidate: Candidate,
  user: User | null,
  userIssues: string[],
  userDealbreakers: string[],
  issues: Array<{ id: string; name: string }>
): FeedItem => {
  const candidateIssueIds = candidate.topIssues?.map((ti) => ti.issueId) || [];
  const { score, matchedIssues, hasDealbreaker } = calculateAlignmentScore(
    candidateIssueIds,
    userIssues,
    candidate.topIssues || [],
    userDealbreakers
  );

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
      topIssues: candidateIssueIds.slice(0, 3).map(
        (id) => issues.find((i) => i.id === id)?.name || id
      ),
      endorsementCount: candidate.endorsementCount || 0,
    },
    alignmentScore: score,
    matchedIssues,
    hasDealbreaker,
  };
};

export default function ForYouScreen() {
  const theme = useTheme();
  const { issues } = useConfigStore();
  const { user } = useAuthStore();

  // Get font scale for accessibility - scales with user's text size preferences
  const fontScale = PixelRatio.getFontScale();

  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isReseeding, setIsReseeding] = useState(false);
  const [filterMenuVisible, setFilterMenuVisible] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all');
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadTrigger, setLoadTrigger] = useState(0);

  // Fetch candidates and generate feed - auto-seeds data if needed
  useEffect(() => {
    const loadFeed = async () => {
      // Wait for issues to be loaded first
      if (issues.length === 0) {
        console.log('Waiting for issues to load...');
        return;
      }

      setIsLoading(true);
      try {
        let candidatesData = await getCandidatesForFeed();
        console.log('Fetched candidates for feed:', candidatesData.length);

        // Auto-seed data if no candidates exist
        if (candidatesData.length === 0) {
          console.log('No candidates found - auto-seeding data...');
          try {
            await reseedAllData();
            // Fetch again after seeding
            candidatesData = await getCandidatesForFeed();
            console.log('After seeding, fetched candidates:', candidatesData.length);
          } catch (seedError) {
            console.warn('Error auto-seeding data:', seedError);
          }
        }

        const userIssues = user?.selectedIssues || [];
        const userDealbreakers = user?.dealbreakers || [];

        const items = candidatesData.map(({ candidate, user: candidateUser }) =>
          generateFeedItem(candidate, candidateUser, userIssues, userDealbreakers, issues)
        );

        // Sort by alignment score (highest first)
        items.sort((a, b) => b.alignmentScore - a.alignmentScore);
        console.log('Generated feed items:', items.length);
        setFeedItems(items);
      } catch (error) {
        console.warn('Error loading feed:', error);
      }
      setIsLoading(false);
    };

    loadFeed();
  }, [issues, user, loadTrigger]);

  const handleReseedData = async () => {
    setIsReseeding(true);
    try {
      await reseedAllData();
      Alert.alert('Success', 'Sample data has been loaded. Refreshing feed...');
      setLoadTrigger((prev) => prev + 1);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load sample data');
    }
    setIsReseeding(false);
  };

  const handleRefresh = () => {
    setLoadTrigger((prev) => prev + 1);
  };

  const getFilteredFeed = () => {
    let filtered = feedItems;

    // Search filter - by candidate name
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((item) =>
        item.candidate.displayName.toLowerCase().includes(query)
      );
    }

    // Filter menu options
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

    // Issue pill filter
    if (selectedIssue) {
      filtered = filtered.filter((item) =>
        item.matchedIssues.includes(selectedIssue)
      );
    }

    return filtered;
  };

  const filteredFeed = getFilteredFeed();

  // Get autocomplete suggestions based on search query
  const getSuggestions = () => {
    if (!searchQuery.trim() || searchQuery.length < 1) return [];
    const query = searchQuery.toLowerCase().trim();
    return feedItems
      .filter((item) =>
        item.candidate.displayName.toLowerCase().includes(query)
      )
      .slice(0, 5); // Limit to 5 suggestions
  };

  const suggestions = getSuggestions();

  const handleSuggestionSelect = (candidateName: string) => {
    setSearchQuery(candidateName);
    setShowSuggestions(false);
    Keyboard.dismiss();
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    setShowSuggestions(text.length > 0);
  };

  const renderPSACard = ({ item }: { item: FeedItem }) => (
    <PSACard feedItem={item} />
  );

  if (isLoading) {
    return <LoadingScreen message="Loading your feed..." />;
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top']}
    >
      {/* Header */}
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

      {/* Search Bar with Autocomplete */}
      <View style={styles.searchContainer}>
        <SearchInput
          label=""
          placeholder="Search candidates..."
          value={searchQuery}
          onChangeText={handleSearchChange}
          onFocus={() => setShowSuggestions(searchQuery.length > 0)}
          onBlur={() => {
            // Delay hiding to allow suggestion tap to register
            setTimeout(() => setShowSuggestions(false), 200);
          }}
          style={styles.searchBar}
        />
        {/* Autocomplete Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <View style={[styles.suggestionsContainer, { backgroundColor: theme.colors.surface }]}>
            {suggestions.map((item, index) => (
              <TouchableRipple
                key={item.id}
                onPress={() => handleSuggestionSelect(item.candidate.displayName)}
                style={[
                  styles.suggestionItem,
                  index < suggestions.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: theme.colors.outlineVariant,
                  },
                ]}
              >
                <View style={styles.suggestionContent}>
                  <Text variant="bodyMedium" style={{ flex: 1 }}>
                    {item.candidate.displayName}
                  </Text>
                  <Text
                    variant="labelSmall"
                    style={{ color: theme.colors.primary }}
                  >
                    {item.alignmentScore}% match
                  </Text>
                </View>
              </TouchableRipple>
            ))}
          </View>
        )}
      </View>

      {/* Issue Pills */}
      {(user?.selectedIssues?.length || 0) > 0 && (
        <FlatList
          horizontal
          data={user?.selectedIssues || []}
          renderItem={({ item }) => {
            const issue = issues.find((i) => i.id === item);
            const isSelected = selectedIssue === item;
            return (
              <Pressable
                onPress={() => setSelectedIssue(isSelected ? null : item)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`Filter by ${issue?.name || item}${isSelected ? ', currently selected' : ''}`}
                style={[
                  styles.issuePill,
                  {
                    backgroundColor: isSelected
                      ? theme.colors.primary
                      : theme.colors.surfaceVariant,
                    paddingHorizontal: 16 * fontScale,
                    paddingVertical: 10 * fontScale,
                    minHeight: 36 * fontScale,
                  },
                ]}
              >
                <Text
                  variant="labelLarge"
                  style={{
                    color: isSelected ? '#fff' : theme.colors.onSurface,
                    fontWeight: isSelected ? '600' : '400',
                  }}
                >
                  {issue?.name || item}
                </Text>
              </Pressable>
            );
          }}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.issuePillsContainer}
        />
      )}

      {/* Feed */}
      {feedItems.length === 0 ? (
        <EmptyState
          icon="account-group-outline"
          title="Loading Candidates"
          message="Setting up your personalized feed. This may take a moment..."
          actionLabel="Retry"
          onAction={handleRefresh}
        />
      ) : filteredFeed.length === 0 ? (
        <EmptyState
          icon="account-search-outline"
          title="No candidates found"
          message={searchQuery ? `No candidates match "${searchQuery}"` : "Try adjusting your filters"}
          actionLabel="Clear Search & Filters"
          onAction={() => {
            setSearchQuery('');
            setSelectedFilter('all');
            setSelectedIssue(null);
          }}
        />
      ) : (
        <FlatList
          data={filteredFeed}
          renderItem={renderPSACard}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={true}
          contentContainerStyle={styles.feedContent}
          onScrollBeginDrag={() => {
            setShowSuggestions(false);
            Keyboard.dismiss();
          }}
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
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 10,
    position: 'relative',
  },
  searchBar: {
    marginBottom: 0,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    borderRadius: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    zIndex: 20,
  },
  suggestionItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  suggestionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  issuePillsContainer: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
  },
  issuePill: {
    borderRadius: 20,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedContent: {
    padding: 16,
    paddingTop: 0,
  },
});
