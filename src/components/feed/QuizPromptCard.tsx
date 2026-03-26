import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { Text, Button, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useUserStore } from '@/stores';

interface QuizPromptCardProps {
  height: number;
}

export default function QuizPromptCard({ height }: QuizPromptCardProps) {
  const theme = useTheme();
  const router = useRouter();
  const user = useUserStore((s) => s.userProfile);
  const completedCount = user?.questionnaireResponses?.length || 0;

  return (
    <View style={[styles.container, { height }]}>
      <View style={[styles.background, { backgroundColor: theme.colors.primary }]} />

      <View style={styles.content}>
        <Image
          source={require('../../../assets/amsp-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <View style={styles.iconCircle}>
          <MaterialCommunityIcons
            name="clipboard-check-outline"
            size={48}
            color={theme.colors.primary}
          />
        </View>

        <Text variant="headlineSmall" style={styles.heading}>
          Unlock Personalized Results
        </Text>

        <Text variant="bodyLarge" style={styles.description}>
          You've completed {completedCount} out of 7 quiz questions.
          Complete more to further refine your search.
        </Text>

        <Button
          mode="contained"
          onPress={() => router.push('/(main)/quiz' as any)}
          style={styles.ctaButton}
          contentStyle={styles.ctaButtonContent}
          labelStyle={styles.ctaButtonLabel}
          icon="arrow-right"
          buttonColor="#fff"
          textColor={theme.colors.primary}
        >
          {completedCount === 0 ? 'Take the Quiz' : 'Continue Quiz'}
        </Button>

        <Text variant="bodySmall" style={styles.scrollHint}>
          or scroll down to browse randomly
        </Text>
        <MaterialCommunityIcons
          name="chevron-down"
          size={24}
          color="rgba(255,255,255,0.6)"
          style={styles.chevron}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.95,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  logo: {
    width: 160,
    height: 44,
    tintColor: '#fff',
    marginBottom: 32,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  heading: {
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  ctaButton: {
    borderRadius: 24,
    marginBottom: 24,
  },
  ctaButtonContent: {
    height: 48,
    paddingHorizontal: 24,
    flexDirection: 'row-reverse',
  },
  ctaButtonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  scrollHint: {
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
  },
  chevron: {
    marginTop: 8,
  },
});
