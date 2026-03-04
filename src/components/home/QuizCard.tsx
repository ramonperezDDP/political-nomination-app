import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Card } from '@/components/ui';
import { useConfigStore } from '@/stores';

interface QuizCardProps {
  completedCount: number;
  totalCount: number;
  onPress: () => void;
}

// Map issue names to single-word labels
function getOneWordLabel(name: string): string {
  const map: Record<string, string> = {
    'Economy & Jobs': 'Economy',
    'Healthcare': 'Health',
    'Climate Change': 'Climate',
    'Immigration': 'Immigration',
    'Education': 'Education',
    'Gun Policy': 'Guns',
    'Civil Rights': 'Rights',
    'Minimum Wage': 'Wages',
    'Prescription Drug Costs': 'Rx Costs',
    'Medicare': 'Medicare',
    'Tax Policy': 'Taxes',
    'Social Security': 'Soc. Sec.',
    'Housing': 'Housing',
    'Criminal Justice': 'Justice',
    'Foreign Policy': 'Foreign',
    'Environment': 'Environ.',
    'Veterans Affairs': 'Veterans',
    'Infrastructure': 'Infra.',
  };
  return map[name] || name.split(' ')[0];
}

export default function QuizCard({ completedCount, totalCount, onPress }: QuizCardProps) {
  const theme = useTheme();
  const { issues } = useConfigStore();

  const displayIssues = issues.slice(0, totalCount);

  return (
    <Pressable onPress={onPress}>
      <Card style={styles.card}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text variant="titleMedium" style={styles.title}>
              Policy Quiz
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
              {completedCount}/{totalCount} completed
            </Text>
          </View>
          <View style={styles.issueGrid}>
            {displayIssues.map((issue, index) => {
              const isCompleted = index < completedCount;
              return (
                <View key={issue.id} style={styles.issueItem}>
                  <View
                    style={[
                      styles.issueCircle,
                      {
                        backgroundColor: isCompleted
                          ? theme.colors.primary
                          : theme.colors.surfaceVariant,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={isCompleted ? 'check' : (issue.icon as any) || 'help-circle-outline'}
                      size={20}
                      color={isCompleted ? '#fff' : theme.colors.outline}
                    />
                  </View>
                  <Text
                    variant="labelSmall"
                    numberOfLines={1}
                    style={[styles.issueLabel, { color: theme.colors.onSurface }]}
                  >
                    {getOneWordLabel(issue.name)}
                  </Text>
                </View>
              );
            })}
          </View>
          {completedCount < totalCount && (
            <View style={[styles.ctaRow, { backgroundColor: theme.colors.primaryContainer }]}>
              <MaterialCommunityIcons
                name="arrow-right-circle"
                size={18}
                color={theme.colors.primary}
              />
              <Text variant="labelMedium" style={{ color: theme.colors.primary, marginLeft: 8 }}>
                {completedCount === 0 ? 'Start the quiz' : 'Continue the quiz'}
              </Text>
            </View>
          )}
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontWeight: 'bold',
  },
  issueGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  issueItem: {
    alignItems: 'center',
    width: 60,
  },
  issueCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  issueLabel: {
    marginTop: 4,
    textAlign: 'center',
    fontSize: 10,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    marginTop: 16,
  },
});
