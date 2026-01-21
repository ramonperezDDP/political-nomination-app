import React, { useState, useEffect } from 'react';
import { StyleSheet, View, FlatList, Pressable } from 'react-native';
import { Text, useTheme, SegmentedButtons, IconButton, Tooltip } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import {
  getEndorsementLeaderboard,
  getTrendingLeaderboard,
} from '@/services/firebase/firestore';
import { useConfigStore } from '@/stores';
import { Card, UserAvatar, RankBadge, LoadingScreen, EmptyState } from '@/components/ui';
import type { LeaderboardEntry } from '@/types';

type LeaderboardType = 'endorsements' | 'trending';

// Mock data for demonstration
const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  {
    candidateId: 'c1',
    candidateName: 'Sarah Johnson',
    photoUrl: undefined,
    endorsementCount: 1560,
    profileViews: 45200,
    trendingScore: 95,
    rank: 1,
    alignmentScore: 91,
  },
  {
    candidateId: 'c2',
    candidateName: 'Jane Smith',
    photoUrl: undefined,
    endorsementCount: 1250,
    profileViews: 38100,
    trendingScore: 88,
    rank: 2,
    alignmentScore: 85,
  },
  {
    candidateId: 'c3',
    candidateName: 'John Doe',
    photoUrl: undefined,
    endorsementCount: 980,
    profileViews: 29800,
    trendingScore: 76,
    rank: 3,
    alignmentScore: 72,
  },
  {
    candidateId: 'c4',
    candidateName: 'Michael Chen',
    photoUrl: undefined,
    endorsementCount: 850,
    profileViews: 22400,
    trendingScore: 68,
    rank: 4,
  },
  {
    candidateId: 'c5',
    candidateName: 'Emily Davis',
    photoUrl: undefined,
    endorsementCount: 720,
    profileViews: 18900,
    trendingScore: 62,
    rank: 5,
  },
  {
    candidateId: 'c6',
    candidateName: 'Robert Wilson',
    photoUrl: undefined,
    endorsementCount: 650,
    profileViews: 15600,
    trendingScore: 55,
    rank: 6,
  },
  {
    candidateId: 'c7',
    candidateName: 'Lisa Anderson',
    photoUrl: undefined,
    endorsementCount: 580,
    profileViews: 12300,
    trendingScore: 48,
    rank: 7,
  },
  {
    candidateId: 'c8',
    candidateName: 'David Martinez',
    photoUrl: undefined,
    endorsementCount: 510,
    profileViews: 9800,
    trendingScore: 42,
    rank: 8,
  },
];

export default function LeaderboardScreen() {
  const theme = useTheme();
  const { partyConfig } = useConfigStore();
  const [leaderboardType, setLeaderboardType] = useState<LeaderboardType>('endorsements');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(MOCK_LEADERBOARD);
  const [isLoading, setIsLoading] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // Get endorsement cutoffs from config
  const cutoffs = partyConfig?.endorsementCutoffs || [
    { stage: 1, threshold: 1000 },
    { stage: 2, threshold: 500 },
  ];

  const getCutoffLine = () => {
    // Find where the cutoff line should be drawn
    const currentCutoff = cutoffs[0]?.threshold || 1000;
    return leaderboard.findIndex((entry) => entry.endorsementCount < currentCutoff);
  };

  const cutoffIndex = getCutoffLine();

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const renderCandidateTile = ({ item, index }: { item: LeaderboardEntry; index: number }) => {
    const isAboveCutoff = cutoffIndex === -1 || index < cutoffIndex;
    const showCutoffLine = index === cutoffIndex;

    return (
      <>
        {showCutoffLine && (
          <View style={styles.cutoffContainer}>
            <View style={[styles.cutoffLine, { backgroundColor: theme.colors.error }]} />
            <Text variant="labelSmall" style={[styles.cutoffText, { color: theme.colors.error }]}>
              Endorsement Threshold ({formatNumber(cutoffs[0]?.threshold || 1000)})
            </Text>
            <View style={[styles.cutoffLine, { backgroundColor: theme.colors.error }]} />
          </View>
        )}
        <Pressable
          onPress={() => router.push(`/candidate/${item.candidateId}`)}
          style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
        >
          <Card
            style={(!isAboveCutoff && leaderboardType === 'endorsements')
              ? [styles.candidateTile, styles.belowCutoff]
              : styles.candidateTile}
          >
            <View style={styles.tileContent}>
              <RankBadge rank={item.rank} style={styles.rankBadge} />
              <UserAvatar
                photoUrl={item.photoUrl}
                displayName={item.candidateName}
                size={48}
              />
              <View style={styles.candidateInfo}>
                <Text variant="titleMedium" style={styles.candidateName}>
                  {item.candidateName}
                </Text>
                <View style={styles.statsRow}>
                  {leaderboardType === 'endorsements' ? (
                    <>
                      <MaterialCommunityIcons
                        name="thumb-up"
                        size={14}
                        color={theme.colors.primary}
                      />
                      <Text variant="bodyMedium" style={styles.statValue}>
                        {formatNumber(item.endorsementCount)}
                      </Text>
                    </>
                  ) : (
                    <>
                      <MaterialCommunityIcons
                        name="eye"
                        size={14}
                        color={theme.colors.secondary}
                      />
                      <Text variant="bodyMedium" style={styles.statValue}>
                        {formatNumber(item.profileViews)}
                      </Text>
                    </>
                  )}
                </View>
              </View>
              {item.alignmentScore && (
                <View style={styles.alignmentContainer}>
                  <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
                    Match
                  </Text>
                  <Text
                    variant="titleSmall"
                    style={{ color: theme.colors.primary, fontWeight: 'bold' }}
                  >
                    {item.alignmentScore}%
                  </Text>
                </View>
              )}
              <MaterialCommunityIcons
                name="chevron-right"
                size={24}
                color={theme.colors.outline}
              />
            </View>
          </Card>
        </Pressable>
      </>
    );
  };

  if (isLoading) {
    return <LoadingScreen message="Loading leaderboard..." />;
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top']}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text variant="headlineSmall" style={styles.title}>
            Leaderboard
          </Text>
          <Tooltip title="How rankings work">
            <IconButton
              icon="information-outline"
              size={20}
              onPress={() => setShowTooltip(!showTooltip)}
            />
          </Tooltip>
        </View>

        <SegmentedButtons
          value={leaderboardType}
          onValueChange={(value) => setLeaderboardType(value as LeaderboardType)}
          buttons={[
            {
              value: 'endorsements',
              label: 'Endorsements',
              icon: 'thumb-up',
            },
            {
              value: 'trending',
              label: 'Trending',
              icon: 'trending-up',
            },
          ]}
          style={styles.segmentedButtons}
        />

        {showTooltip && (
          <Card style={styles.tooltipCard}>
            <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
              {leaderboardType === 'endorsements'
                ? 'Rankings based on total endorsements. Candidates below the threshold line may not advance to the voting stage.'
                : 'Rankings based on recent profile views and engagement. Trending score updates daily.'}
            </Text>
          </Card>
        )}
      </View>

      {leaderboard.length === 0 ? (
        <EmptyState
          icon="trophy-outline"
          title="No candidates yet"
          message="Check back soon as candidates begin their campaigns"
        />
      ) : (
        <FlatList
          data={leaderboard}
          renderItem={renderCandidateTile}
          keyExtractor={(item) => item.candidateId}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
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
    padding: 16,
    paddingBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontWeight: 'bold',
  },
  segmentedButtons: {
    marginBottom: 8,
  },
  tooltipCard: {
    padding: 12,
    marginTop: 8,
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
  },
  cutoffContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  cutoffLine: {
    flex: 1,
    height: 2,
  },
  cutoffText: {
    marginHorizontal: 12,
    fontWeight: '600',
  },
  candidateTile: {
    marginBottom: 12,
  },
  belowCutoff: {
    opacity: 0.6,
  },
  tileContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
  },
  rankBadge: {
    marginRight: 12,
  },
  candidateInfo: {
    flex: 1,
    marginLeft: 12,
  },
  candidateName: {
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statValue: {
    marginLeft: 4,
    fontWeight: '500',
  },
  alignmentContainer: {
    alignItems: 'center',
    marginRight: 8,
  },
});
