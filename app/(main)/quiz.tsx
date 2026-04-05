import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { StyleSheet, View, ScrollView, Pressable, Platform } from 'react-native';
import { Text, useTheme, RadioButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView as NativeSafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

const SafeAreaView = Platform.OS === 'web' ? View : NativeSafeAreaView;

import { useAuthStore, useUserStore } from '@/stores';
import { getActiveQuestions, updateSingleQuizResponse, updateUser, reseedAllData } from '@/services/firebase/firestore';
import { LoadingScreen } from '@/components/ui';
import type { Question, QuestionnaireResponse, QuestionScope } from '@/types';

const DEFAULT_DISTRICT = 'PA-01';

const SCOPE_LABELS: Record<QuestionScope, string> = {
  global: 'Global Issues',
  national: 'National Issues',
  local: 'Local Issues',
};

const SCOPE_ORDER: QuestionScope[] = ['global', 'national', 'local'];

export default function QuizScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuthStore();
  const selectedDistrict = useUserStore((s) => s.selectedBrowsingDistrict) || DEFAULT_DISTRICT;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<Map<string, QuestionnaireResponse>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load questions and existing responses
  useEffect(() => {
    const load = async () => {
      try {
        let fetched = await getActiveQuestions(selectedDistrict);
        // If no questions found (old seed data), trigger a full reseed
        if (fetched.length === 0) {
          console.log('Quiz: No active questions found — reseeding all data...');
          await reseedAllData();
          fetched = await getActiveQuestions(selectedDistrict);
        }
        setQuestions(fetched);

        // Load existing responses keyed by questionId
        if (user?.questionnaireResponses?.length) {
          const questionIds = new Set(fetched.map((q) => q.id));
          const m = new Map<string, QuestionnaireResponse>();
          user.questionnaireResponses.forEach((r) => {
            if (questionIds.has(r.questionId)) {
              m.set(r.questionId, r);
            }
          });
          setResponses(m);
        }
      } catch (error) {
        console.warn('Error loading quiz data:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedDistrict, user?.questionnaireResponses]);

  // Group questions by scope
  const sections = useMemo(() => {
    const grouped = new Map<QuestionScope, Question[]>();
    for (const q of questions) {
      const scope = q.scope || 'national';
      if (!grouped.has(scope)) grouped.set(scope, []);
      grouped.get(scope)!.push(q);
    }
    return SCOPE_ORDER
      .filter((s) => grouped.has(s))
      .map((s) => ({ scope: s, title: SCOPE_LABELS[s], questions: grouped.get(s)! }));
  }, [questions]);

  const totalQuestions = questions.length;
  const completedCount = responses.size;

  // All question issue IDs for setting selectedIssues
  const allQuestionIssueIds = useMemo(() => questions.map((q) => q.issueId), [questions]);

  const handleSelectAnswer = useCallback(
    async (question: Question, spectrumValue: number) => {
      if (!user?.id || saving) return;

      setSaving(true);

      const response: QuestionnaireResponse = {
        questionId: question.id,
        issueId: question.issueId,
        answer: spectrumValue,
      };

      try {
        await updateSingleQuizResponse(user.id, response);

        // Update local state
        setResponses((prev) => {
          const m = new Map(prev);
          m.set(question.id, response);
          return m;
        });

        // Set selectedIssues to the quiz question issue IDs if not already matching
        const currentIssues = user.selectedIssues || [];
        const needsUpdate = allQuestionIssueIds.some((id) => !currentIssues.includes(id));
        if (needsUpdate) {
          await updateUser(user.id, { selectedIssues: allQuestionIssueIds });
        }
      } catch (error) {
        console.warn('Error saving quiz response:', error);
      } finally {
        setSaving(false);
      }
    },
    [user?.id, user?.selectedIssues, saving, allQuestionIssueIds]
  );

  if (loading) {
    return <LoadingScreen message="Loading quiz..." />;
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top', 'bottom']}
    >
      {/* Web-only back header */}
      {Platform.OS === 'web' && (
        <View style={[styles.webHeader, { borderBottomColor: theme.colors.outlineVariant }]}>
          <Pressable onPress={() => router.back()} style={styles.webBackButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.onSurface} />
            <Text variant="titleMedium" style={{ color: theme.colors.onSurface, marginLeft: 8 }}>
              Your Quiz
            </Text>
          </Pressable>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Progress banner */}
        <View style={[styles.progressBanner, { backgroundColor: theme.colors.primaryContainer }]}>
          <MaterialCommunityIcons
            name="clipboard-check-outline"
            size={18}
            color={theme.colors.primary}
          />
          <Text variant="labelLarge" style={{ color: theme.colors.primary, marginLeft: 8 }}>
            {completedCount} of {totalQuestions} questions answered
          </Text>
        </View>

        {sections.map((section) => (
          <View key={section.scope} style={styles.section}>
            <Text
              variant="titleMedium"
              style={[styles.sectionTitle, { color: theme.colors.onSurface }]}
            >
              {section.title}
            </Text>

            {section.questions.map((question) => {
              const currentResponse = responses.get(question.id);
              const selectedValue = currentResponse ? String(currentResponse.answer) : '';

              return (
                <View
                  key={question.id}
                  style={[styles.questionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}
                >
                  <Text
                    variant="bodyLarge"
                    style={[styles.questionText, { color: theme.colors.onSurface }]}
                  >
                    {question.text}
                  </Text>

                  <RadioButton.Group
                    onValueChange={(value) => {
                      const numValue = Number(value);
                      handleSelectAnswer(question, numValue);
                    }}
                    value={selectedValue}
                  >
                    {question.options?.map((option) => {
                      const isSelected = selectedValue === String(option.spectrumValue);
                      return (
                        <Pressable
                          key={option.id}
                          onPress={() => handleSelectAnswer(question, option.spectrumValue)}
                          style={[
                            styles.optionCard,
                            {
                              backgroundColor: isSelected
                                ? theme.colors.primaryContainer
                                : theme.colors.surfaceVariant,
                              borderColor: isSelected
                                ? theme.colors.primary
                                : 'transparent',
                            },
                          ]}
                        >
                          <RadioButton value={String(option.spectrumValue)} />
                          <View style={styles.optionContent}>
                            <Text
                              variant="labelLarge"
                              style={[styles.optionLabel, { color: theme.colors.onSurface }]}
                            >
                              {option.shortLabel}
                            </Text>
                            <Text
                              variant="bodySmall"
                              style={{ color: theme.colors.onSurfaceVariant }}
                            >
                              {option.text}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </RadioButton.Group>
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  webBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 16,
    borderRadius: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: 12,
  },
  questionCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  questionText: {
    fontWeight: '600',
    marginBottom: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    marginBottom: 8,
  },
  optionContent: {
    flex: 1,
    marginLeft: 4,
  },
  optionLabel: {
    fontWeight: 'bold',
    marginBottom: 2,
  },
});
