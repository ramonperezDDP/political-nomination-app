import React, { useState, useMemo, useEffect, useRef } from 'react';
import { StyleSheet, View, Pressable, Modal, ScrollView, Animated, Platform } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Card } from '@/components/ui';
import { useConfigStore, selectContestTimeline, selectCurrentRoundId } from '@/stores';
import type { ContestRound } from '@/types';

const ROUND_DETAILS: Record<string, { day: string; result: string }> = {
  round_1_endorsement: { day: 'Monday & Tuesday', result: 'Top 20' },
  round_2_endorsement: { day: 'Wednesday', result: 'Top 10' },
  round_3_endorsement: { day: 'Thursday', result: 'Top 4' },
  virtual_town_hall: { day: 'Friday', result: 'Top 2' },
  debate: { day: 'Saturday', result: 'Nominee' },
  final_results: { day: 'Sunday', result: '' },
};

const INTRO_TEXT =
  "Experience the beta version of the America's Main Street Party nominating app. This demo offers a new approach to candidate selection. Every week, a mock nominating contest is held, giving you the chance to filter the field and support prospective avatar nominees who share your values. The following is an overview of the process:";

export default function AboutContestCard() {
  const theme = useTheme();
  const [visible, setVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(400)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const contestRounds = useConfigStore(selectContestTimeline);
  const currentRoundId = useConfigStore(selectCurrentRoundId);

  const currentOrder = useMemo(
    () => contestRounds.find((r) => r.id === currentRoundId)?.order ?? 0,
    [contestRounds, currentRoundId]
  );

  const getRoundStatus = (round: ContestRound): 'past' | 'current' | 'future' => {
    if (round.order < currentOrder) return 'past';
    if (round.order === currentOrder) return 'current';
    return 'future';
  };

  const displayRounds = contestRounds.filter((round) => round.id !== 'post_election');

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(backdropAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, damping: 20, stiffness: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 400, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (displayRounds.length === 0) return null;

  const sheetContent = (
    <View style={Platform.OS === 'web' ? styles.webBackdrop : styles.backdrop}>
      <Animated.View style={[styles.backdropOverlay, { opacity: backdropAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setVisible(false)} />
      </Animated.View>
      <Animated.View
        style={[styles.sheet, { backgroundColor: theme.colors.surface, transform: [{ translateY: slideAnim }] }]}
      >
        <View style={[styles.handle, { backgroundColor: theme.colors.outlineVariant }]} />

        <Text variant="titleMedium" style={styles.sheetTitle}>
          About the Contest
        </Text>

        <ScrollView style={styles.scrollContent} bounces={false}>
          <Text variant="bodyMedium" style={[styles.introText, { color: theme.colors.onSurfaceVariant }]}>
            {INTRO_TEXT}
          </Text>

          {displayRounds.map((round, index, arr) => {
            const status = getRoundStatus(round);
            const isActive = status === 'current';
            const isPast = status === 'past';
            const details = ROUND_DETAILS[round.id];

            return (
              <View key={round.id} style={styles.timelineItem}>
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

                  {details && (
                    <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                      {details.day}{details.result ? `  ·  ${details.result}` : ''}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      </Animated.View>
    </View>
  );

  const modal = Platform.OS === 'web' ? (
    visible ? sheetContent : null
  ) : (
    <Modal
      visible={visible}
      animationType="none"
      transparent={true}
      onRequestClose={() => setVisible(false)}
    >
      {sheetContent}
    </Modal>
  );

  return (
    <>
      <Card style={styles.buttonCard} onPress={() => setVisible(true)}>
        <View style={styles.buttonContent}>
          <MaterialCommunityIcons
            name="information-outline"
            size={24}
            color={theme.colors.primary}
          />
          <Text variant="titleMedium" style={[styles.buttonLabel, { color: theme.colors.onSurface }]}>
            About the Contest
          </Text>
          <MaterialCommunityIcons
            name="chevron-right"
            size={24}
            color={theme.colors.outline}
          />
        </View>
      </Card>
      {modal}
    </>
  );
}

const styles = StyleSheet.create({
  buttonCard: {
    marginBottom: 16,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  buttonLabel: {
    flex: 1,
    fontWeight: '600',
    marginLeft: 12,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  webBackdrop: {
    position: 'fixed' as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    zIndex: 9999,
  },
  backdropOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 12,
    maxHeight: '90%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontWeight: 'bold',
    marginBottom: 12,
  },
  scrollContent: {
    flexGrow: 0,
    paddingBottom: 16,
  },
  introText: {
    marginBottom: 16,
    lineHeight: 22,
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
