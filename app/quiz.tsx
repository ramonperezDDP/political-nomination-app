import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { StyleSheet, View, ScrollView, Pressable, Platform } from 'react-native';
import { Text, useTheme, RadioButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView as NativeSafeAreaView } from 'react-native-safe-area-context';

const SafeAreaView = Platform.OS === 'web' ? View : NativeSafeAreaView;

import { useAuthStore, useConfigStore } from '@/stores';
import { getQuestions, updateSingleQuizResponse } from '@/services/firebase/firestore';
import { BottomSheet, LoadingScreen } from '@/components/ui';
import type { Issue, Question, QuestionnaireResponse } from '@/types';

// District issue mapping (hardcoded for MVP; production would use Firestore)
const DISTRICT_ISSUES: Record<string, { global: string[]; national: string[]; local: string[] }> = {
  'PA-01': {
    global: ['climate-change', 'economy'],
    national: ['healthcare', 'education', 'gun-policy'],
    local: ['infrastructure', 'housing'],
  },
  'PA-02': {
    global: ['climate-change', 'economy'],
    national: ['healthcare', 'immigration', 'criminal-justice'],
    local: ['infrastructure', 'housing'],
  },
};

const DEFAULT_DISTRICT = 'PA-01';

// Map issue names to one-word labels (same as QuizCard)
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
    'Prescription Drug Prices': 'Rx Costs',
    'Medicare & Medicaid': 'Medicare',
    'Tax Policy': 'Taxes',
    'Social Security': 'Soc. Sec.',
    'Housing': 'Housing',
    'Criminal Justice Reform': 'Justice',
    'Foreign Policy': 'Foreign',
    'Environment': 'Environ.',
    'Veterans Affairs': 'Veterans',
    'Infrastructure': 'Infra.',
  };
  return map[name] || name.split(' ')[0];
}

interface SectionData {
  title: string;
  issues: Issue[];
}

export default function QuizScreen() {
  const theme = useTheme();
  const { user } = useAuthStore();
  const { issues: allIssues } = useConfigStore();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<Map<string, QuestionnaireResponse>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [sheetAnswer, setSheetAnswer] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Get district config
  const district = user?.lastBrowsingDistrict || DEFAULT_DISTRICT;
  const districtConfig = DISTRICT_ISSUES[district] || DISTRICT_ISSUES[DEFAULT_DISTRICT];
  const allIssueIds = useMemo(
    () => [...districtConfig.global, ...districtConfig.national, ...districtConfig.local],
    [districtConfig]
  );

  // Build issue lookup from configStore
  const issueMap = useMemo(() => {
    const m = new Map<string, Issue>();
    allIssues.forEach((i) => m.set(i.id, i));
    return m;
  }, [allIssues]);

  // Build sections
  const sections: SectionData[] = useMemo(() => {
    const resolve = (ids: string[]) =>
      ids.map((id) => issueMap.get(id)).filter(Boolean) as Issue[];
    return [
      { title: 'Global Issues', issues: resolve(districtConfig.global) },
      { title: 'National Issues', issues: resolve(districtConfig.national) },
      { title: 'Local Issues', issues: resolve(districtConfig.local) },
    ];
  }, [districtConfig, issueMap]);

  // Load questions and existing responses on mount
  useEffect(() => {
    const load = async () => {
      try {
        const fetched = await getQuestions(allIssueIds);
        setQuestions(fetched);

        // Load existing responses from user profile
        if (user?.questionnaireResponses?.length) {
          const m = new Map<string, QuestionnaireResponse>();
          user.questionnaireResponses.forEach((r) => {
            if (allIssueIds.includes(r.issueId)) {
              m.set(r.issueId, r);
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
  }, [allIssueIds, user?.questionnaireResponses]);

  // Question for the selected issue
  const activeQuestion = useMemo(() => {
    if (!selectedIssueId) return null;
    return questions.find((q) => q.issueId === selectedIssueId) || null;
  }, [selectedIssueId, questions]);

  // When bottom sheet opens, set the current answer if it exists
  useEffect(() => {
    if (selectedIssueId) {
      const existing = responses.get(selectedIssueId);
      setSheetAnswer(existing ? String(existing.answer) : '');
    }
  }, [selectedIssueId, responses]);

  const completedCount = responses.size;

  const handleIssuePress = useCallback((issueId: string) => {
    setSelectedIssueId(issueId);
  }, []);

  const handleCloseSheet = useCallback(() => {
    setSelectedIssueId(null);
    setSheetAnswer('');
  }, []);

  const handleSelectAnswer = useCallback(
    async (value: string) => {
      if (!user?.id || !selectedIssueId || !activeQuestion || saving) return;

      setSheetAnswer(value);
      setSaving(true);

      const response: QuestionnaireResponse = {
        questionId: activeQuestion.id,
        issueId: selectedIssueId,
        answer: value,
      };

      try {
        const updated = await updateSingleQuizResponse(user.id, response);

        // Update local state
        setResponses((prev) => {
          const m = new Map(prev);
          m.set(selectedIssueId, response);
          return m;
        });

        // On first answer, set selectedIssues to the 7 district issue IDs
        // (the realtime subscription in userStore will auto-sync)
      } catch (error) {
        console.warn('Error saving quiz response:', error);
      } finally {
        setSaving(false);
        // Close sheet after brief delay so user sees their selection
        setTimeout(() => {
          setSelectedIssueId(null);
          setSheetAnswer('');
        }, 400);
      }
    },
    [user?.id, selectedIssueId, activeQuestion, saving]
  );

  if (loading) {
    return <LoadingScreen message="Loading quiz..." />;
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['bottom']}
    >
      {/* Progress banner */}
      <View style={[styles.progressBanner, { backgroundColor: theme.colors.primaryContainer }]}>
        <MaterialCommunityIcons
          name="clipboard-check-outline"
          size={18}
          color={theme.colors.primary}
        />
        <Text variant="labelLarge" style={{ color: theme.colors.primary, marginLeft: 8 }}>
          {completedCount} out of {allIssueIds.length} quiz questions completed
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text
              variant="titleMedium"
              style={[styles.sectionTitle, { color: theme.colors.onSurface }]}
            >
              {section.title}
            </Text>
            <View style={styles.issueGrid}>
              {section.issues.map((issue) => {
                const isCompleted = responses.has(issue.id);
                return (
                  <Pressable
                    key={issue.id}
                    onPress={() => handleIssuePress(issue.id)}
                    style={styles.issueItem}
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
                        name={isCompleted ? 'check' : (issue.icon as any) || 'help-circle-outline'}
                        size={24}
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
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Bottom sheet for answering a question */}
      <BottomSheet
        visible={!!selectedIssueId && !!activeQuestion}
        onDismiss={handleCloseSheet}
        title={activeQuestion?.text}
      >
        <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
          {activeQuestion?.options && (
            <RadioButton.Group
              onValueChange={handleSelectAnswer}
              value={sheetAnswer}
            >
              {activeQuestion.options.map((option) => (
                <Pressable
                  key={option.id}
                  onPress={() => handleSelectAnswer(String(option.value))}
                  style={[
                    styles.optionCard,
                    {
                      backgroundColor:
                        sheetAnswer === String(option.value)
                          ? theme.colors.primaryContainer
                          : theme.colors.surfaceVariant,
                      borderColor:
                        sheetAnswer === String(option.value)
                          ? theme.colors.primary
                          : 'transparent',
                    },
                  ]}
                >
                  <RadioButton value={String(option.value)} />
                  <Text variant="bodyMedium" style={styles.optionText}>
                    {option.text}
                  </Text>
                </Pressable>
              ))}
            </RadioButton.Group>
          )}
        </ScrollView>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  progressBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 16,
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
  issueGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  issueItem: {
    alignItems: 'center',
    width: 72,
  },
  issueCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  issueLabel: {
    marginTop: 6,
    textAlign: 'center',
    fontSize: 11,
  },
  sheetScroll: {
    maxHeight: 400,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    marginBottom: 8,
  },
  optionText: {
    flex: 1,
    marginLeft: 8,
  },
});
