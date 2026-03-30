import React from 'react';
import { StyleSheet, View, Pressable, Platform } from 'react-native';
import { Text, useTheme, Portal, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface AlignmentMatch {
  issueId: string;
  name: string;
}

interface AlignmentExplainerModalProps {
  visible: boolean;
  onDismiss: () => void;
  score: number | null;
  sharedCount: number;
  exactMatches: AlignmentMatch[];
  closeMatches: AlignmentMatch[];
  notMatched: AlignmentMatch[];
  candidateName?: string;
  chipColor?: string;
}

export default function AlignmentExplainerModal({
  visible,
  onDismiss,
  score,
  sharedCount,
  exactMatches,
  closeMatches,
  notMatched,
  candidateName,
  chipColor = '#E0E0E0',
}: AlignmentExplainerModalProps) {
  const theme = useTheme();

  if (!visible) return null;

  const roundedScore = score != null ? Math.round(score) : null;

  return (
    <Portal>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable style={[styles.modal, { backgroundColor: theme.colors.surface }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text variant="titleMedium" style={styles.title}>
              {candidateName ? `Alignment with ${candidateName}` : 'Alignment Breakdown'}
            </Text>
            <Pressable onPress={onDismiss} hitSlop={8}>
              <MaterialCommunityIcons name="close" size={24} color={theme.colors.onSurface} />
            </Pressable>
          </View>

          {roundedScore != null && (
            <View style={styles.scoreRow}>
              <Text variant="headlineMedium" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
                {roundedScore}%
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.outline, marginLeft: 8 }}>
                match based on {sharedCount} shared responses
              </Text>
            </View>
          )}

          {exactMatches.length > 0 && (
            <View style={styles.section}>
              <Text variant="labelSmall" style={{ color: theme.colors.primary, marginBottom: 4 }}>
                Exact position matches
              </Text>
              <View style={styles.chips}>
                {exactMatches.map((p) => (
                  <Chip key={p.issueId} style={[styles.chip, { backgroundColor: chipColor }]} textStyle={{ fontSize: 12 }}>
                    {p.name}
                  </Chip>
                ))}
              </View>
            </View>
          )}

          {closeMatches.length > 0 && (
            <View style={styles.section}>
              <Text variant="labelSmall" style={{ color: theme.colors.outline, marginBottom: 4 }}>
                Close matches
              </Text>
              <View style={styles.chips}>
                {closeMatches.map((p) => (
                  <Chip key={p.issueId} style={[styles.chip, { backgroundColor: theme.colors.surfaceVariant }]} textStyle={{ fontSize: 12 }}>
                    {p.name}
                  </Chip>
                ))}
              </View>
            </View>
          )}

          {notMatched.length > 0 && (
            <View style={styles.section}>
              <Text variant="labelSmall" style={{ color: theme.colors.error, marginBottom: 4 }}>
                Not matched
              </Text>
              <View style={styles.chips}>
                {notMatched.map((p) => (
                  <Chip key={p.issueId} style={[styles.chip, { backgroundColor: theme.colors.errorContainer }]} textStyle={{ fontSize: 12, color: theme.colors.onErrorContainer }}>
                    {p.name}
                  </Chip>
                ))}
              </View>
            </View>
          )}

          {sharedCount === 0 && (
            <Text variant="bodyMedium" style={{ color: theme.colors.outline, textAlign: 'center', marginTop: 8 }}>
              Complete the quiz to see your alignment with this candidate.
            </Text>
          )}
        </Pressable>
      </Pressable>
    </Portal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modal: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8 },
      android: { elevation: 8 },
      default: {},
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontWeight: '600',
    flex: 1,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  section: {
    marginBottom: 12,
    alignItems: 'center',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  chip: {
    marginBottom: 2,
  },
});
