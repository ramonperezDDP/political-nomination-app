import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Card } from '@/components/ui';
import { useConfigStore, selectContestTimeline, selectCurrentRoundId } from '@/stores';
import type { ContestRound } from '@/types';

const VOTING_METHOD_LABELS: Record<string, string> = {
  approval: 'Approval Voting',
  ranked_choice: 'Ranked Choice',
  pick_one: 'Pick One',
  none: '',
};

export default function AboutContestCard() {
  const theme = useTheme();

  // All hooks at top level — configStore owns fetch/subscription, this component is selector-only
  const contestRounds = useConfigStore(selectContestTimeline);
  const currentRoundId = useConfigStore(selectCurrentRoundId);

  // Precompute current order once (not per-item)
  const currentOrder = useMemo(
    () => contestRounds.find((r) => r.id === currentRoundId)?.order ?? 0,
    [contestRounds, currentRoundId]
  );

  // Pure function used inside .map() — no hooks
  const getRoundStatus = (round: ContestRound): 'past' | 'current' | 'future' => {
    if (round.order < currentOrder) return 'past';
    if (round.order === currentOrder) return 'current';
    return 'future';
  };

  const displayRounds = contestRounds.filter((round) => round.id !== 'post_election');

  if (displayRounds.length === 0) return null;

  return (
    <View>
      <Text variant="titleMedium" style={styles.sectionTitle}>About the Contest</Text>
      <Card style={styles.contestCard}>
        {displayRounds.map((round, index, arr) => {
          const status = getRoundStatus(round);
          const isActive = status === 'current';
          const isPast = status === 'past';

          return (
            <View key={round.id} style={styles.timelineItem}>
              {/* Timeline dot and connecting line */}
              <View style={styles.timelineDot}>
                <MaterialCommunityIcons
                  name={isPast ? 'check-circle' : isActive ? 'circle-double' : 'circle-outline'}
                  size={24}
                  color={
                    isActive ? theme.colors.primary
                    : isPast ? theme.colors.outline
                    : theme.colors.outlineVariant
                  }
                />
                {index < arr.length - 1 && (
                  <View
                    style={[
                      styles.timelineLine,
                      { backgroundColor: isPast ? theme.colors.outline : theme.colors.outlineVariant },
                    ]}
                  />
                )}
              </View>

              {/* Round content */}
              <View style={styles.timelineContent}>
                <View style={styles.timelineLabelRow}>
                  <Text
                    variant="titleSmall"
                    style={{
                      fontWeight: isActive ? 'bold' : '500',
                      color: isActive ? theme.colors.primary : theme.colors.onSurface,
                      flex: 1,
                    }}
                  >
                    {round.label}
                  </Text>
                  {isActive && (
                    <Text variant="labelSmall" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
                      Current
                    </Text>
                  )}
                </View>

                {/* Candidate count: e.g., "100 candidates → 20 advance" */}
                {round.candidatesEntering != null && round.candidatesAdvancing != null && (
                  <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                    {round.candidatesEntering} candidates → {round.candidatesAdvancing} advance
                  </Text>
                )}

                {/* Voting method label */}
                {round.votingMethod !== 'none' && VOTING_METHOD_LABELS[round.votingMethod] && (
                  <Text variant="labelSmall" style={{ color: theme.colors.outline, marginTop: 2 }}>
                    {VOTING_METHOD_LABELS[round.votingMethod]}
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: 12,
    marginTop: 8,
  },
  contestCard: {
    marginBottom: 24,
    padding: 16,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  timelineDot: {
    alignItems: 'center',
    width: 32,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginVertical: 4,
  },
  timelineContent: {
    flex: 1,
    marginLeft: 12,
    paddingBottom: 16,
  },
  timelineLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
});
