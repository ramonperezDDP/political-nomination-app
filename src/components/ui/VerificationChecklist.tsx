import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, Divider, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useUserStore, selectCompletionPercent } from '@/stores';

export default function VerificationChecklist() {
  const theme = useTheme();
  const router = useRouter();
  const user = useUserStore((s) => s.userProfile);
  const completionPercent = useUserStore(selectCompletionPercent);

  if (!user) return null;

  const steps = [
    {
      id: 'email',
      label: 'Verify Email',
      icon: 'email-check' as const,
      status: user.verification?.email || 'unverified',
      route: '/(auth)/verify-identity',
      description: 'Check your inbox for a verification link',
    },
    {
      id: 'voterReg',
      label: 'Voter Registration',
      icon: 'card-account-details' as const,
      status: user.verification?.voterRegistration || 'unverified',
      route: '/(auth)/verify-identity',
      description: 'Confirm your voter registration to unlock endorsements in your districts',
    },
    {
      id: 'photoId',
      label: 'Photo ID',
      icon: 'camera-account' as const,
      status: user.verification?.photoId || 'unverified',
      route: '/(auth)/verify-identity',
      description: 'Upload a government-issued photo ID',
    },
    {
      id: 'questionnaire',
      label: 'Policy Quiz',
      icon: 'clipboard-check' as const,
      status: user.onboarding?.questionnaire || 'incomplete',
      route: '/(main)/quiz',
      description: 'Answer at least 1 policy question to see your matches',
    },
    {
      id: 'dealbreakers',
      label: 'Dealbreakers',
      icon: 'alert-circle' as const,
      status: user.onboarding?.dealbreakers || 'incomplete',
      route: '/(main)/(profile)/dealbreakers',
      description: 'Set your non-negotiable policy positions',
    },
  ];

  const isDone = (status: string) => status === 'verified' || status === 'complete';
  const isPending = (status: string) => status === 'pending';

  return (
    <View style={styles.container}>
      <Text variant="titleMedium" style={styles.title}>
        Your Progress — {completionPercent}%
      </Text>
      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${completionPercent}%` as any,
              backgroundColor: theme.colors.primary,
            },
          ]}
        />
      </View>

      {steps.map((step, index) => (
        <View key={step.id}>
          {index > 0 && <Divider />}
          <View style={styles.stepRow}>
            <MaterialCommunityIcons
              name={
                isDone(step.status)
                  ? 'check-circle'
                  : isPending(step.status)
                    ? 'clock-outline'
                    : 'circle-outline'
              }
              size={24}
              color={
                isDone(step.status)
                  ? '#4caf50'
                  : isPending(step.status)
                    ? '#ff9800'
                    : theme.colors.outline
              }
            />
            <View style={styles.stepInfo}>
              <Text
                variant="bodyMedium"
                style={[styles.stepLabel, isDone(step.status) && styles.stepDone]}
              >
                {step.label}
              </Text>
              <Text variant="bodySmall" style={styles.stepDesc}>
                {isDone(step.status)
                  ? 'Completed'
                  : isPending(step.status)
                    ? 'Pending verification'
                    : step.description}
              </Text>
            </View>
            {!isDone(step.status) && (
              <Button
                mode="text"
                compact
                onPress={() => router.push(step.route as any)}
              >
                {isPending(step.status) ? 'Check' : 'Start'}
              </Button>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  title: { marginBottom: 12, fontWeight: '600' },
  progressBar: {
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  stepInfo: { flex: 1 },
  stepLabel: { fontWeight: '500' },
  stepDone: { textDecorationLine: 'line-through', opacity: 0.6 },
  stepDesc: { color: '#666', marginTop: 2 },
});
