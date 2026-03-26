import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme, List } from 'react-native-paper';
import { router } from 'expo-router';

import { Card } from '@/components/ui';
import { useAuthStore, useConfigStore, useUserStore, selectHasAccount, selectCurrentRoundId } from '@/stores';
import { getFaqsForRound } from '@/constants/faqs';
import VideoCard from './VideoCard';
import QuizCard from './QuizCard';
import ContentCard from './ContentCard';
import AboutContestCard from './AboutContestCard';

// District issue IDs (must match quiz.tsx DISTRICT_ISSUES)
const DISTRICT_ISSUE_IDS = [
  'climate-change', 'economy', 'healthcare', 'education',
  'gun-policy', 'infrastructure', 'housing',
  'immigration', 'criminal-justice',
];

export default function VoterHome() {
  const theme = useTheme();
  const { partyConfig } = useConfigStore();
  const user = useAuthStore((s) => s.user);
  const hasAccount = useUserStore(selectHasAccount);
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  // Count only responses for district issues (not legacy questionnaire responses)
  const completedIssueCount = useMemo(() => {
    if (!user?.questionnaireResponses?.length) return 0;
    return user.questionnaireResponses.filter((r) =>
      DISTRICT_ISSUE_IDS.includes(r.issueId)
    ).length;
  }, [user?.questionnaireResponses]);
  const totalIssues = 7;

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
        onPress={() => router.push('/(main)/quiz' as any)}
      />

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
