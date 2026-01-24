import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, FlatList, Pressable, Alert } from 'react-native';
import { Text, useTheme, SegmentedButtons, IconButton, Tooltip, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import {
  getEndorsementLeaderboard,
  getTrendingLeaderboard,
  seedCandidates,
  getCandidatesWithUsers,
} from '@/services/firebase/firestore';
import { useConfigStore } from '@/stores';
import { Card, CandidateAvatar, RankBadge, LoadingScreen, EmptyState } from '@/components/ui';
import type { LeaderboardEntry } from '@/types';

type LeaderboardType = 'endorsements' | 'trending';

export default function LeaderboardScreen() {
  const theme = useTheme();
  const { partyConfig } = useConfigStore();
  const [leaderboardType, setLeaderboardType] = useState<LeaderboardType>('endorsements');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const fetchLeaderboard = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getCandidatesWithUsers(leaderboardType);
      setLeaderboard(data);
    } catch (error) {
      console.warn('Error fetching leaderboard:', error);
    }
    setIsLoading(false);
  }, [leaderboardType]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const handleSeedCandidates = async () => {
    setIsSeeding(true);
    try {
      await seedCandidates();
      Alert.alert('Success', '24 sample candidates have been created!');
      fetchLeaderboard();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
    setIsSeeding(false);
  };

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
              <CandidateAvatar
                candidateId={item.candidateId}
                displayName={item.candidateName}
                gender={item.gender}
                spectrumPosition={item.averageSpectrum}
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

      {leaderboard.length === 0 && !isLoading ? (
        <View style={styles.emptyContainer}>
          <EmptyState
            icon="trophy-outline"
            title="No candidates yet"
            message="Tap below to populate sample candidates for testing"
          />
          <Button
            mode="contained"
            onPress={handleSeedCandidates}
            loading={isSeeding}
            disabled={isSeeding}
            style={styles.seedButton}
          >
            Load Sample Candidates
          </Button>
        </View>
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  seedButton: {
    marginTop: 16,
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
