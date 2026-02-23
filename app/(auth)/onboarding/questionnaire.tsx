import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, View, ScrollView, Platform } from 'react-native';
import { Text, useTheme, RadioButton, ProgressBar } from 'react-native-paper';
import Slider from '@react-native-community/slider';
import { router } from 'expo-router';
import { SafeAreaView as NativeSafeAreaView } from 'react-native-safe-area-context';

const SafeAreaView = Platform.OS === 'web' ? View : NativeSafeAreaView;

import { useAuthStore, useUserStore } from '@/stores';
import { getQuestions, ensureQuestionsExist } from '@/services/firebase/firestore';
import {
  PrimaryButton,
  SecondaryButton,
  Card,
  LoadingScreen,
} from '@/components/ui';
import type { Question, QuestionnaireResponse } from '@/types';

export default function QuestionnaireScreen() {
  const theme = useTheme();
  const { user } = useAuthStore();
  const { updateQuestionnaireResponses, isLoading } = useUserStore();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<Map<string, QuestionnaireResponse>>(new Map());
  const [loadingQuestions, setLoadingQuestions] = useState(true);

  // Fetch questions based on selected issues (auto-seed if needed)
  useEffect(() => {
    const fetchQuestions = async () => {
      // Wait for user to load
      if (!user) {
        return;
      }

      if (!user.selectedIssues?.length) {
        // Only redirect if we're sure the user is loaded but has no issues
        const timeoutId = setTimeout(() => {
          if (!user.selectedIssues?.length) {
            router.replace('/(auth)/onboarding/issues');
          }
        }, 1500);
        return () => clearTimeout(timeoutId);
      }

      try {
        // Ensure questions are seeded first
        await ensureQuestionsExist();

        // Then fetch questions for user's selected issues
        const fetchedQuestions = await getQuestions(user.selectedIssues);
        setQuestions(fetchedQuestions);
      } catch (error) {
        console.error('Error fetching questions:', error);
      } finally {
        setLoadingQuestions(false);
      }
    };

    fetchQuestions();
  }, [user]);

  const currentQuestion = questions[currentIndex];
  const progress = questions.length > 0 ? (currentIndex + 1) / questions.length : 0;

  const currentResponse = currentQuestion
    ? responses.get(currentQuestion.id)
    : undefined;

  const handleAnswer = (answer: string | number | string[]) => {
    if (!currentQuestion) return;

    const response: QuestionnaireResponse = {
      questionId: currentQuestion.id,
      issueId: currentQuestion.issueId,
      answer,
    };

    setResponses((prev) => {
      const updated = new Map(prev);
      updated.set(currentQuestion.id, response);
      return updated;
    });
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleComplete = async () => {
    if (!user?.id) return;

    const responseArray = Array.from(responses.values());
    const success = await updateQuestionnaireResponses(user.id, responseArray);

    if (success) {
      router.push('/(auth)/onboarding/dealbreakers');
    }
  };

  const isCurrentAnswered = currentResponse !== undefined;
  const allAnswered = questions.every((q) => responses.has(q.id));
  const isLastQuestion = currentIndex === questions.length - 1;

  if (loadingQuestions) {
    return <LoadingScreen message="Loading questions..." />;
  }

  if (questions.length === 0) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        edges={['bottom']}
      >
        <View style={styles.emptyState}>
          <Text variant="headlineSmall" style={styles.emptyTitle}>
            No Questions Available
          </Text>
          <Text
            variant="bodyLarge"
            style={[styles.emptyText, { color: theme.colors.outline }]}
          >
            There are no questionnaire questions for your selected issues yet. You can continue to the next step.
          </Text>
          <PrimaryButton
            onPress={() => router.push('/(auth)/onboarding/dealbreakers')}
            style={styles.continueButton}
          >
            Continue
          </PrimaryButton>
        </View>
      </SafeAreaView>
    );
  }

  const renderQuestion = () => {
    if (!currentQuestion) return null;

    switch (currentQuestion.type) {
      case 'single_choice':
        return (
          <RadioButton.Group
            onValueChange={handleAnswer}
            value={(currentResponse?.answer as string) || ''}
          >
            {currentQuestion.options?.map((option) => (
              <Card
                key={option.id}
                style={currentResponse?.answer === option.value
                  ? [styles.optionCard, { borderColor: theme.colors.primary, borderWidth: 2 }]
                  : styles.optionCard}
                onPress={() => handleAnswer(option.value)}
              >
                <View style={styles.optionContent}>
                  <RadioButton value={option.value as string} />
                  <Text variant="bodyLarge" style={styles.optionText}>
                    {option.text}
                  </Text>
                </View>
              </Card>
            ))}
          </RadioButton.Group>
        );

      case 'slider':
        const sliderConfig = currentQuestion.sliderConfig;
        const sliderValue =
          (currentResponse?.answer as number) ?? sliderConfig?.min ?? 0;

        return (
          <View style={styles.sliderContainer}>
            <View style={styles.sliderLabels}>
              <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                {sliderConfig?.leftLabel}
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                {sliderConfig?.rightLabel}
              </Text>
            </View>
            <Slider
              value={sliderValue}
              onValueChange={handleAnswer}
              minimumValue={sliderConfig?.min ?? 0}
              maximumValue={sliderConfig?.max ?? 100}
              step={sliderConfig?.step ?? 1}
              style={styles.slider}
            />
            <Text variant="titleMedium" style={styles.sliderValue}>
              {sliderValue}
            </Text>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['bottom']}
    >
      <View style={styles.progressContainer}>
        <View style={styles.progressHeader}>
          <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
            Question {currentIndex + 1} of {questions.length}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
            {Math.round(progress * 100)}%
          </Text>
        </View>
        <ProgressBar
          progress={progress}
          color={theme.colors.primary}
          style={styles.progressBar}
        />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {currentQuestion && (
          <View style={styles.questionContainer}>
            <Text variant="titleLarge" style={styles.questionText}>
              {currentQuestion.text}
            </Text>

            {renderQuestion()}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.navigation}>
          <SecondaryButton
            onPress={handlePrevious}
            disabled={currentIndex === 0}
            style={styles.navButton}
          >
            Previous
          </SecondaryButton>

          {isLastQuestion ? (
            <PrimaryButton
              onPress={handleComplete}
              disabled={!allAnswered}
              loading={isLoading}
              style={styles.navButton}
            >
              Complete
            </PrimaryButton>
          ) : (
            <PrimaryButton
              onPress={handleNext}
              disabled={!isCurrentAnswered}
              style={styles.navButton}
            >
              Next
            </PrimaryButton>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  progressContainer: {
    padding: 24,
    paddingBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 0,
  },
  questionContainer: {},
  questionText: {
    fontWeight: 'bold',
    marginBottom: 24,
  },
  optionCard: {
    marginBottom: 12,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionText: {
    flex: 1,
    marginLeft: 8,
  },
  sliderContainer: {
    paddingVertical: 16,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderValue: {
    textAlign: 'center',
    marginTop: 8,
  },
  footer: {
    padding: 24,
    paddingTop: 16,
  },
  navigation: {
    flexDirection: 'row',
    gap: 12,
  },
  navButton: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyText: {
    textAlign: 'center',
    marginBottom: 24,
  },
  continueButton: {
    minWidth: 150,
  },
});
