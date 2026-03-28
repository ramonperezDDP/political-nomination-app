import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Card } from '@/components/ui';

interface QuizQuestion {
  id: string;
  label: string;
  icon: string;
  scope: 'global' | 'national' | 'local';
}

// New quiz questions mapped by district
const QUIZ_QUESTIONS: Record<string, QuizQuestion[]> = {
  'PA-01': [
    { id: 'trade-1', label: 'Trade', icon: 'swap-horizontal', scope: 'global' },
    { id: 'iran-1', label: 'Iran', icon: 'earth', scope: 'global' },
    { id: 'inflation-1', label: 'Inflation', icon: 'trending-up', scope: 'national' },
    { id: 'borders-1', label: 'Borders', icon: 'passport', scope: 'national' },
    { id: 'welfare-1', label: 'Welfare', icon: 'account-group', scope: 'national' },
    { id: 'pa01-infrastructure-1', label: 'Infrastructure', icon: 'bridge', scope: 'local' },
    { id: 'pa01-housing-1', label: 'Housing', icon: 'home-city', scope: 'local' },
  ],
  'PA-02': [
    { id: 'trade-1', label: 'Trade', icon: 'swap-horizontal', scope: 'global' },
    { id: 'iran-1', label: 'Iran', icon: 'earth', scope: 'global' },
    { id: 'inflation-1', label: 'Inflation', icon: 'trending-up', scope: 'national' },
    { id: 'borders-1', label: 'Borders', icon: 'passport', scope: 'national' },
    { id: 'welfare-1', label: 'Welfare', icon: 'account-group', scope: 'national' },
    { id: 'pa02-budget-1', label: 'Budget', icon: 'cash-multiple', scope: 'local' },
    { id: 'pa02-transit-1', label: 'Transit', icon: 'train', scope: 'local' },
  ],
};

interface QuizCardProps {
  completedCount: number;
  totalCount: number;
  answeredQuestionIds: string[];
  district: string;
  onPress: () => void;
  onQuestionPress: (questionId: string) => void;
}

export default function QuizCard({ completedCount, totalCount, answeredQuestionIds, district, onPress, onQuestionPress }: QuizCardProps) {
  const theme = useTheme();

  const questions = QUIZ_QUESTIONS[district] || QUIZ_QUESTIONS['PA-01'];
  const answeredSet = new Set(answeredQuestionIds);

  return (
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
          {questions.map((q) => {
            const isCompleted = answeredSet.has(q.id);
            return (
              <Pressable
                key={q.id}
                onPress={() => onQuestionPress(q.id)}
                style={styles.issueItem}
                hitSlop={4}
                accessibilityRole="button"
                accessibilityLabel={`${q.label} — ${isCompleted ? 'answered' : 'not answered'}`}
              >
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
                    name={isCompleted ? 'check' : (q.icon as any)}
                    size={20}
                    color={isCompleted ? '#fff' : theme.colors.outline}
                  />
                </View>
                <Text
                  variant="labelSmall"
                  numberOfLines={1}
                  style={[styles.issueLabel, { color: theme.colors.onSurface }]}
                >
                  {q.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {completedCount < totalCount && (
          <Pressable onPress={onPress}>
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
          </Pressable>
        )}
      </View>
    </Card>
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
    width: 48,
    height: 48,
    borderRadius: 24,
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
