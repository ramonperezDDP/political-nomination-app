import React, { useMemo } from 'react';
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
    { id: 'pa01-infrastructure-1', label: 'Infra.', icon: 'bridge', scope: 'local' },
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

const SCOPE_LABELS: Record<string, string> = {
  global: 'Global',
  national: 'National',
  local: 'Local',
};

const SCOPE_ORDER: Array<'global' | 'national' | 'local'> = ['global', 'national', 'local'];

interface QuizCardProps {
  completedCount: number;
  totalCount: number;
  answeredQuestionIds: string[];
  district: string;
  onQuestionPress: (questionId: string) => void;
}

export default function QuizCard({ completedCount, totalCount, answeredQuestionIds, district, onQuestionPress }: QuizCardProps) {
  const theme = useTheme();

  const questions = QUIZ_QUESTIONS[district] || QUIZ_QUESTIONS['PA-01'];
  const answeredSet = new Set(answeredQuestionIds);

  const sections = useMemo(() => {
    return SCOPE_ORDER
      .map((scope) => ({
        scope,
        label: SCOPE_LABELS[scope],
        questions: questions.filter((q) => q.scope === scope),
      }))
      .filter((s) => s.questions.length > 0);
  }, [questions]);

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

        <View style={styles.columnsContainer}>
          {sections.map((section) => (
            <View key={section.scope} style={styles.column}>
              <Text variant="labelSmall" style={[styles.sectionLabel, { color: theme.colors.outline }]}>
                {section.label}
              </Text>
              {section.questions.map((q) => {
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
          ))}
        </View>

      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
  },
  content: {
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontWeight: 'bold',
  },
  columnsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  column: {
    alignItems: 'center',
    flex: 1,
  },
  sectionLabel: {
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 10,
    marginBottom: 8,
  },
  issueItem: {
    alignItems: 'center',
    marginBottom: 6,
  },
  issueCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  issueLabel: {
    marginTop: 3,
    textAlign: 'center',
    fontSize: 10,
  },
});
