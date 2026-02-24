import React, { useState } from 'react';
import { StyleSheet, View, Linking, Pressable } from 'react-native';
import { Text, useTheme, List } from 'react-native-paper';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';

import { Card, PrimaryButton, SecondaryButton } from '@/components/ui';
import { useConfigStore } from '@/stores';

export default function VoterHome() {
  const theme = useTheme();
  const partyConfig = useConfigStore((state) => state.partyConfig);
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  const externalLinks = [
    {
      id: 'register',
      title: 'Register to Vote',
      description: 'Check your registration status',
      icon: 'vote',
      url: 'https://vote.gov',
      isExternal: true,
    },
    {
      id: 'issues',
      title: 'Policy Preferences',
      description: 'Set your policy priorities',
      icon: 'tune',
      route: '/settings/issues',
      isExternal: false,
    },
    {
      id: 'calendar',
      title: 'Election Calendar',
      description: 'Important dates and deadlines',
      icon: 'calendar',
      url: 'https://www.usa.gov/election-day',
      isExternal: true,
    },
  ];

  const faqs = [
    {
      id: 'endorsement',
      question: 'How do endorsements work?',
      answer:
        'Endorsements are your way of showing support for candidates. You can endorse multiple candidates, and your endorsements help determine who advances in the nomination process. Endorsements are anonymous to candidates.',
    },
    {
      id: 'alignment',
      question: 'What is the alignment score?',
      answer:
        'The alignment score shows how closely a candidate\'s positions match your preferences based on the questionnaire you completed. A higher score means better alignment with your values.',
    },
    {
      id: 'dealbreakers',
      question: 'Can I change my dealbreakers?',
      answer:
        'Yes! You can update your dealbreakers anytime in your profile settings. Candidates with dealbreaker positions will be clearly marked in your feed.',
    },
    {
      id: 'voting',
      question: 'When can I vote?',
      answer:
        'Voting opens after the endorsement phase ends. You\'ll be notified when voting begins. Only candidates who meet the endorsement threshold will appear on the ballot.',
    },
  ];

  return (
    <View style={styles.container}>
      {/* Welcome Video Section */}
      <Card style={styles.videoCard}>
        <View style={styles.videoContainer}>
          <View style={[styles.videoPlaceholder, { backgroundColor: theme.colors.surfaceVariant }]}>
            <MaterialCommunityIcons
              name="play-circle-outline"
              size={64}
              color={theme.colors.primary}
            />
            <Text variant="bodyMedium" style={{ color: theme.colors.outline, marginTop: 8 }}>
              Welcome Video
            </Text>
          </View>
        </View>
        <View style={styles.videoInfo}>
          <Text variant="titleMedium" style={styles.videoTitle}>
            Welcome to {partyConfig?.partyName || "America's Main Street Party"}
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.outline }}>
            Learn how our democratic nomination process works
          </Text>
        </View>
      </Card>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <PrimaryButton
          onPress={() => router.push('/(tabs)/for-you')}
          icon="cards"
          style={styles.actionButton}
        >
          Browse Candidates
        </PrimaryButton>
        <SecondaryButton
          onPress={() => router.push('/(tabs)/leaderboard')}
          icon="trophy"
          style={styles.actionButton}
        >
          View Leaderboard
        </SecondaryButton>
      </View>

      {/* External Links */}
      <Text variant="titleMedium" style={styles.sectionTitle}>
        Resources
      </Text>
      <View style={styles.linksGrid}>
        {externalLinks.map((link) => (
          <Pressable
            key={link.id}
            onPress={() => {
              if (link.isExternal && link.url) {
                Linking.openURL(link.url);
              } else if (link.route) {
                router.push(link.route as any);
              }
            }}
            style={({ pressed }) => [
              styles.linkCard,
              { backgroundColor: theme.colors.surface, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <MaterialCommunityIcons
              name={link.icon as any}
              size={32}
              color={theme.colors.primary}
            />
            <Text variant="titleSmall" style={styles.linkTitle}>
              {link.title}
            </Text>
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.outline, textAlign: 'center' }}
            >
              {link.description}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* FAQ Section */}
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

      {/* Run for Office CTA */}
      <Card style={[styles.ctaCard, { backgroundColor: theme.colors.primaryContainer }]}>
        <View style={styles.ctaContent}>
          <MaterialCommunityIcons
            name="account-tie"
            size={48}
            color={theme.colors.primary}
          />
          <View style={styles.ctaText}>
            <Text variant="titleMedium" style={{ color: theme.colors.onPrimaryContainer }}>
              Want to Run for Office?
            </Text>
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onPrimaryContainer, opacity: 0.8 }}
            >
              Learn how you can become a candidate
            </Text>
          </View>
        </View>
        <PrimaryButton
          onPress={() => router.push('/(tabs)/profile')}
          style={styles.ctaButton}
        >
          Learn More
        </PrimaryButton>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  videoCard: {
    marginBottom: 16,
    overflow: 'hidden',
  },
  videoContainer: {
    aspectRatio: 16 / 9,
    width: '100%',
  },
  videoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    margin: 12,
  },
  videoInfo: {
    padding: 16,
    paddingTop: 8,
  },
  videoTitle: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  quickActions: {
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {},
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: 12,
  },
  linksGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  linkCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  linkTitle: {
    marginTop: 8,
    marginBottom: 4,
    textAlign: 'center',
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
  ctaCard: {
    marginBottom: 24,
    padding: 20,
  },
  ctaContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  ctaText: {
    marginLeft: 16,
    flex: 1,
  },
  ctaButton: {},
});
