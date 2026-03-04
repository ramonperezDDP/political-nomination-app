import React, { useState } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Card } from '@/components/ui';

const STAGES = [
  { label: 'Entire Field', flex: 2 },
  { label: '20', flex: 1 },
  { label: '10', flex: 1 },
  { label: '4', flex: 1.5, sub: 'Virtual\nTown Hall' },
  { label: '2', flex: 1.5, sub: 'Final\nDebate' },
  { label: 'Nominee', flex: 2, highlight: true },
];

export default function AboutContestCard() {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);

  return (
    <Card style={styles.card}>
      <Pressable
        onPress={() => setExpanded(!expanded)}
        style={styles.header}
      >
        <MaterialCommunityIcons
          name="information"
          size={24}
          color={theme.colors.primary}
        />
        <Text variant="titleMedium" style={styles.title}>
          About The Contest
        </Text>
        <MaterialCommunityIcons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={24}
          color={theme.colors.outline}
        />
      </Pressable>

      {expanded && (
        <View style={styles.content}>
          <Text variant="bodyMedium" style={[styles.text, { color: theme.colors.onSurface }]}>
            The AMSP nomination process narrows the field over one week through
            endorsement rounds. Each day represents one week of the actual process.
          </Text>

          {/* Nomination Timeline */}
          <View style={[styles.timelineRow, { borderColor: theme.colors.outlineVariant }]}>
            {STAGES.map((stage, i) => (
              <View
                key={i}
                style={[
                  styles.timelineCell,
                  { flex: stage.flex },
                  i < STAGES.length - 1 && {
                    borderRightWidth: 1,
                    borderRightColor: theme.colors.outlineVariant,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.stageLabel,
                    { color: stage.highlight ? theme.colors.primary : theme.colors.onSurface },
                  ]}
                >
                  {stage.label}
                </Text>
                {stage.sub && (
                  <Text style={[styles.stageSub, { color: theme.colors.outline }]}>
                    {stage.sub}
                  </Text>
                )}
              </View>
            ))}
          </View>

          <View style={[styles.endorsementBar, { backgroundColor: theme.colors.primaryContainer }]}>
            <Text variant="labelSmall" style={{ color: theme.colors.primary, fontWeight: '600' }}>
              Endorsement Round
            </Text>
          </View>

          <Text variant="bodyMedium" style={[styles.text, { color: theme.colors.onSurface }]}>
            Voters endorse candidates whose positions align with their values.
            Candidates who don't meet the endorsement threshold at each stage
            are eliminated. The final nominee represents the party.
          </Text>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  title: {
    flex: 1,
    fontWeight: '600',
    marginLeft: 12,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  text: {
    lineHeight: 22,
    marginBottom: 16,
  },
  timelineRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
  },
  timelineCell: {
    paddingVertical: 12,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stageLabel: {
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 11,
  },
  stageSub: {
    textAlign: 'center',
    marginTop: 4,
    fontSize: 9,
  },
  endorsementBar: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    alignItems: 'center',
    marginBottom: 16,
  },
});
