import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme, List } from 'react-native-paper';
import { router } from 'expo-router';

import { Card } from '@/components/ui';
import { useAuthStore, useConfigStore, useUserStore, selectHasAccount, selectCurrentRoundId } from '@/stores';
import { getFaqsForRound } from '@/constants/faqs';
import { getActiveQuestions, updateSingleQuizResponse, clearQuizResponse, updateUser } from '@/services/firebase/firestore';
import type { Question, QuestionnaireResponse } from '@/types';
import VideoCard from './VideoCard';
import QuizCard from './QuizCard';
import QuizBottomSheet from './QuizBottomSheet';
import ContentCard from './ContentCard';
import AboutContestCard from './AboutContestCard';

// PLAN-10C: New quiz question IDs by district
const QUIZ_QUESTION_IDS: Record<string, string[]> = {
  'PA-01': ['trade-1', 'iran-1', 'inflation-1', 'borders-1', 'welfare-1', 'pa01-infrastructure-1', 'pa01-housing-1'],
  'PA-02': ['trade-1', 'iran-1', 'inflation-1', 'borders-1', 'welfare-1', 'pa02-budget-1', 'pa02-transit-1'],
};

export default function VoterHome() {
  const theme = useTheme();
  const { partyConfig } = useConfigStore();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const hasAccount = useUserStore(selectHasAccount);
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  const selectedDistrict = useUserStore((s) => s.selectedBrowsingDistrict) || 'PA-01';
  const districtQuestionIds = QUIZ_QUESTION_IDS[selectedDistrict] || QUIZ_QUESTION_IDS['PA-01'];

  // Bottom sheet state
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(true);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load questions for the selected district
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const fetched = await getActiveQuestions(selectedDistrict);
        if (!cancelled) setQuestions(fetched);
      } catch (err) {
        console.warn('VoterHome: Error loading questions:', err);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [selectedDistrict]);

  // District-change safety: dismiss bottom sheet if district changes
  useEffect(() => {
    setActiveQuestionId(null);
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, [selectedDistrict]);

  const activeQuestion = useMemo(
    () => questions.find((q) => q.id === activeQuestionId) || null,
    [questions, activeQuestionId]
  );

  const currentAnswerForActive = useMemo(() => {
    if (!activeQuestionId || !user?.questionnaireResponses?.length) return undefined;
    const resp = user.questionnaireResponses.find((r) => r.questionId === activeQuestionId);
    return resp ? (resp.answer as number) : undefined;
  }, [activeQuestionId, user?.questionnaireResponses]);

  const handleQuestionPress = useCallback((questionId: string) => {
    setShowHint(false);
    setSaveError(null);
    setActiveQuestionId(questionId);
  }, []);

  const handleDismiss = useCallback(() => {
    setActiveQuestionId(null);
    setSaveError(null);
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  const handleAnswer = useCallback(async (spectrumValue: number) => {
    if (!user?.id || !activeQuestion || saving) return;

    setSaving(true);
    setSaveError(null);

    const response: QuestionnaireResponse = {
      questionId: activeQuestion.id,
      issueId: activeQuestion.issueId,
      answer: spectrumValue,
    };

    // Optimistic: update local user state immediately
    const existing = user.questionnaireResponses || [];
    const idx = existing.findIndex((r) => r.questionId === activeQuestion.id);
    const updatedResponses = [...existing];
    if (idx >= 0) {
      updatedResponses[idx] = response;
    } else {
      updatedResponses.push(response);
    }
    setUser({ ...user, questionnaireResponses: updatedResponses });

    try {
      await updateSingleQuizResponse(user.id, response);

      // Update selectedIssues if needed
      const allIssueIds = questions.map((q) => q.issueId);
      const currentIssues = user.selectedIssues || [];
      const needsUpdate = allIssueIds.some((id) => !currentIssues.includes(id));
      if (needsUpdate) {
        await updateUser(user.id, { selectedIssues: allIssueIds });
      }

      // Auto-dismiss after delay
      dismissTimerRef.current = setTimeout(() => {
        setActiveQuestionId(null);
        setSaving(false);
        dismissTimerRef.current = null;
      }, 450);
    } catch (error) {
      console.warn('VoterHome: Error saving quiz response:', error);
      // Revert optimistic update
      setUser({ ...user, questionnaireResponses: existing });
      setSaveError('Failed to save. Try again.');
      setSaving(false);
    }
  }, [user, activeQuestion, saving, questions, setUser]);

  const handleClear = useCallback(async () => {
    if (!user?.id || !activeQuestion || saving) return;

    setSaving(true);
    setSaveError(null);

    // Optimistic: remove from local state
    const existing = user.questionnaireResponses || [];
    const updatedResponses = existing.filter((r) => r.questionId !== activeQuestion.id);
    setUser({ ...user, questionnaireResponses: updatedResponses });

    try {
      await clearQuizResponse(user.id, activeQuestion.id);

      dismissTimerRef.current = setTimeout(() => {
        setActiveQuestionId(null);
        setSaving(false);
        dismissTimerRef.current = null;
      }, 450);
    } catch (error) {
      console.warn('VoterHome: Error clearing quiz response:', error);
      setUser({ ...user, questionnaireResponses: existing });
      setSaveError('Failed to clear. Try again.');
      setSaving(false);
    }
  }, [user, activeQuestion, saving, setUser]);

  // Count only responses for quiz questions in the current district
  const completedIssueCount = useMemo(() => {
    if (!user?.questionnaireResponses?.length) return 0;
    return user.questionnaireResponses.filter((r) =>
      districtQuestionIds.includes(r.questionId)
    ).length;
  }, [user?.questionnaireResponses, districtQuestionIds]);
  const totalIssues = districtQuestionIds.length;

  const currentRoundId = useConfigStore(selectCurrentRoundId);
  const faqs = useMemo(() => getFaqsForRound(currentRoundId), [currentRoundId]);

  return (
    <View style={styles.container}>
      {/* 1. Video — "A Brand New Way" */}
      <VideoCard />

      {/* 2. Quiz — 7 Issues Graphic */}
      <QuizCard
        completedCount={completedIssueCount}
        totalCount={totalIssues}
        answeredQuestionIds={
          user?.questionnaireResponses
            ?.filter((r) => districtQuestionIds.includes(r.questionId))
            .map((r) => r.questionId) || []
        }
        district={selectedDistrict}
        onPress={() => router.push('/(main)/quiz' as any)}
        onQuestionPress={handleQuestionPress}
      />
      {showHint && completedIssueCount === 0 && (
        <Text variant="bodySmall" style={[styles.hintText, { color: theme.colors.outline }]}>
          Tap a topic to answer quickly
        </Text>
      )}

      {activeQuestionId && (
        <QuizBottomSheet
          visible={!!activeQuestionId}
          question={activeQuestion}
          currentAnswer={currentAnswerForActive}
          onAnswer={handleAnswer}
          onClear={handleClear}
          onDismiss={handleDismiss}
          saving={saving}
          error={saveError}
        />
      )}

      {/* 3. Character Search */}
      <ContentCard
        icon="account-search"
        title="Character Search"
        subtitle="Find candidates by name or policy position"
        onPress={() => router.push('/(main)/(feed)' as any)}
      />

      {/* 4. Verify ID */}
      <ContentCard
        icon="shield-check"
        title="Verify Your Identity"
        subtitle={
          hasAccount
            ? 'Verify to unlock endorsement features'
            : 'Create an account and verify to endorse candidates'
        }
        onPress={() =>
          hasAccount
            ? router.push('/(auth)/verify-identity' as any)
            : router.push('/(auth)/register')
        }
        completed={user?.verification?.photoId === 'verified'}
      />

      {/* 5. Submit / Endorse */}
      <ContentCard
        icon="thumb-up"
        title="Submit / Endorse"
        subtitle="Apply filters and endorse matching candidates"
        onPress={() => router.push('/(main)/(feed)' as any)}
      />

      {/* 6. About The Contest (includes nomination calendar) */}
      <AboutContestCard />

      {/* 7. FAQs */}
      <Text variant="titleMedium" style={styles.sectionTitle}>
        Frequently Asked Questions
      </Text>
      <Card style={styles.faqCard}>
        {faqs.map((faq, index) => (
          <List.Accordion
            key={faq.id}
            title={faq.question}
            expanded={expandedFaq === faq.id}
            onPress={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
            style={[
              styles.faqItem,
              index < faqs.length - 1 && {
                borderBottomWidth: 1,
                borderBottomColor: theme.colors.outlineVariant,
              },
            ]}
            titleStyle={styles.faqQuestion}
          >
            <Text
              variant="bodyMedium"
              style={[styles.faqAnswer, { color: theme.colors.outline }]}
            >
              {faq.answer}
            </Text>
          </List.Accordion>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  hintText: {
    textAlign: 'center',
    marginTop: -8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: 12,
    marginTop: 4,
  },
  faqCard: {
    marginBottom: 24,
    overflow: 'hidden',
  },
  faqItem: {
    paddingHorizontal: 0,
  },
  faqQuestion: {
    fontWeight: '600',
  },
  faqAnswer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
});
