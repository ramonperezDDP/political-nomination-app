import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, Platform } from 'react-native';
import { Text, useTheme, ProgressBar } from 'react-native-paper';
import { router } from 'expo-router';
import { SafeAreaView as NativeSafeAreaView } from 'react-native-safe-area-context';

const SafeAreaView = Platform.OS === 'web' ? View : NativeSafeAreaView;
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAuthStore } from '@/stores';
import {
  PrimaryButton,
  SecondaryButton,
  Card,
  LoadingOverlay,
} from '@/components/ui';

type VerificationStep = 'intro' | 'document' | 'selfie' | 'processing' | 'complete' | 'failed';

export default function VerifyIdentityScreen() {
  const theme = useTheme();
  const { user } = useAuthStore();
  const [currentStep, setCurrentStep] = useState<VerificationStep>('intro');
  const [isLoading, setIsLoading] = useState(false);

  const getProgress = () => {
    switch (currentStep) {
      case 'intro':
        return 0;
      case 'document':
        return 0.33;
      case 'selfie':
        return 0.66;
      case 'processing':
      case 'complete':
        return 1;
      default:
        return 0;
    }
  };

  const handleStartVerification = () => {
    setCurrentStep('document');
  };

  const handleDocumentCapture = async () => {
    // In a real app, this would integrate with Onfido SDK
    setIsLoading(true);
    // Simulate document capture
    setTimeout(() => {
      setIsLoading(false);
      setCurrentStep('selfie');
    }, 1500);
  };

  const handleSelfieCapture = async () => {
    setIsLoading(true);
    // Simulate selfie capture and processing
    setTimeout(() => {
      setIsLoading(false);
      setCurrentStep('processing');
      // Simulate verification processing
      setTimeout(() => {
        setCurrentStep('complete');
      }, 2000);
    }, 1500);
  };

  const handleContinue = () => {
    router.replace('/(auth)/onboarding/issues');
  };

  const handleSkip = () => {
    router.replace('/(auth)/onboarding/issues');
  };

  const renderIntroStep = () => (
    <View style={styles.stepContent}>
      <MaterialCommunityIcons
        name="shield-check"
        size={80}
        color={theme.colors.primary}
        style={styles.icon}
      />
      <Text variant="headlineSmall" style={styles.stepTitle}>
        Verify Your Identity
      </Text>
      <Text
        variant="bodyLarge"
        style={[styles.stepDescription, { color: theme.colors.outline }]}
      >
        To ensure the integrity of our democratic process, we need to verify your identity. This helps prevent fraud and ensures one person, one vote.
      </Text>

      <View style={styles.infoCards}>
        <Card style={styles.infoCard}>
          <View style={styles.infoCardContent}>
            <MaterialCommunityIcons
              name="card-account-details"
              size={24}
              color={theme.colors.primary}
            />
            <View style={styles.infoCardText}>
              <Text variant="titleSmall">Government ID</Text>
              <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                Driver's license, passport, or state ID
              </Text>
            </View>
          </View>
        </Card>

        <Card style={styles.infoCard}>
          <View style={styles.infoCardContent}>
            <MaterialCommunityIcons
              name="camera-account"
              size={24}
              color={theme.colors.primary}
            />
            <View style={styles.infoCardText}>
              <Text variant="titleSmall">Selfie Verification</Text>
              <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                Quick photo to match your ID
              </Text>
            </View>
          </View>
        </Card>

        <Card style={styles.infoCard}>
          <View style={styles.infoCardContent}>
            <MaterialCommunityIcons
              name="lock"
              size={24}
              color={theme.colors.primary}
            />
            <View style={styles.infoCardText}>
              <Text variant="titleSmall">Secure & Private</Text>
              <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                Your data is encrypted and protected
              </Text>
            </View>
          </View>
        </Card>
      </View>

      <PrimaryButton onPress={handleStartVerification} style={styles.actionButton}>
        Start Verification
      </PrimaryButton>
      <SecondaryButton onPress={handleSkip} style={styles.secondaryAction}>
        Skip for Now
      </SecondaryButton>
    </View>
  );

  const renderDocumentStep = () => (
    <View style={styles.stepContent}>
      <MaterialCommunityIcons
        name="card-account-details-outline"
        size={80}
        color={theme.colors.primary}
        style={styles.icon}
      />
      <Text variant="headlineSmall" style={styles.stepTitle}>
        Scan Your ID
      </Text>
      <Text
        variant="bodyLarge"
        style={[styles.stepDescription, { color: theme.colors.outline }]}
      >
        Position your government-issued ID within the frame. Make sure all text is clearly visible.
      </Text>

      <View style={[styles.cameraPlaceholder, { borderColor: theme.colors.outline }]}>
        <MaterialCommunityIcons
          name="camera"
          size={48}
          color={theme.colors.outline}
        />
        <Text variant="bodyMedium" style={{ color: theme.colors.outline }}>
          Camera preview would appear here
        </Text>
      </View>

      <PrimaryButton onPress={handleDocumentCapture} style={styles.actionButton}>
        Capture Document
      </PrimaryButton>
    </View>
  );

  const renderSelfieStep = () => (
    <View style={styles.stepContent}>
      <MaterialCommunityIcons
        name="account-circle-outline"
        size={80}
        color={theme.colors.primary}
        style={styles.icon}
      />
      <Text variant="headlineSmall" style={styles.stepTitle}>
        Take a Selfie
      </Text>
      <Text
        variant="bodyLarge"
        style={[styles.stepDescription, { color: theme.colors.outline }]}
      >
        Position your face within the circle. We'll compare this with your ID photo.
      </Text>

      <View style={[styles.selfiePlaceholder, { borderColor: theme.colors.outline }]}>
        <MaterialCommunityIcons
          name="account"
          size={64}
          color={theme.colors.outline}
        />
      </View>

      <PrimaryButton onPress={handleSelfieCapture} style={styles.actionButton}>
        Take Selfie
      </PrimaryButton>
    </View>
  );

  const renderProcessingStep = () => (
    <View style={styles.stepContent}>
      <MaterialCommunityIcons
        name="cog"
        size={80}
        color={theme.colors.primary}
        style={styles.icon}
      />
      <Text variant="headlineSmall" style={styles.stepTitle}>
        Verifying...
      </Text>
      <Text
        variant="bodyLarge"
        style={[styles.stepDescription, { color: theme.colors.outline }]}
      >
        Please wait while we verify your identity. This usually takes just a moment.
      </Text>
      <ProgressBar
        indeterminate
        color={theme.colors.primary}
        style={styles.progressBar}
      />
    </View>
  );

  const renderCompleteStep = () => (
    <View style={styles.stepContent}>
      <MaterialCommunityIcons
        name="check-circle"
        size={80}
        color="#4caf50"
        style={styles.icon}
      />
      <Text variant="headlineSmall" style={styles.stepTitle}>
        Verification Complete!
      </Text>
      <Text
        variant="bodyLarge"
        style={[styles.stepDescription, { color: theme.colors.outline }]}
      >
        Your identity has been verified. You're now ready to participate in the democratic process.
      </Text>

      <PrimaryButton onPress={handleContinue} style={styles.actionButton}>
        Continue to Setup
      </PrimaryButton>
    </View>
  );

  const renderFailedStep = () => (
    <View style={styles.stepContent}>
      <MaterialCommunityIcons
        name="alert-circle"
        size={80}
        color={theme.colors.error}
        style={styles.icon}
      />
      <Text variant="headlineSmall" style={styles.stepTitle}>
        Verification Failed
      </Text>
      <Text
        variant="bodyLarge"
        style={[styles.stepDescription, { color: theme.colors.outline }]}
      >
        We couldn't verify your identity. This might be due to image quality or mismatched information.
      </Text>

      <PrimaryButton
        onPress={() => setCurrentStep('document')}
        style={styles.actionButton}
      >
        Try Again
      </PrimaryButton>
      <SecondaryButton onPress={handleSkip} style={styles.secondaryAction}>
        Contact Support
      </SecondaryButton>
    </View>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'intro':
        return renderIntroStep();
      case 'document':
        return renderDocumentStep();
      case 'selfie':
        return renderSelfieStep();
      case 'processing':
        return renderProcessingStep();
      case 'complete':
        return renderCompleteStep();
      case 'failed':
        return renderFailedStep();
      default:
        return renderIntroStep();
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['bottom']}
    >
      <LoadingOverlay visible={isLoading} message="Processing..." />

      {currentStep !== 'intro' && currentStep !== 'failed' && (
        <View style={styles.progressContainer}>
          <ProgressBar
            progress={getProgress()}
            color={theme.colors.primary}
            style={styles.progressBar}
          />
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderCurrentStep()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  progressContainer: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  stepContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginBottom: 24,
  },
  stepTitle: {
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  stepDescription: {
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  infoCards: {
    width: '100%',
    marginBottom: 32,
  },
  infoCard: {
    marginBottom: 12,
  },
  infoCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoCardText: {
    marginLeft: 16,
    flex: 1,
  },
  cameraPlaceholder: {
    width: '100%',
    aspectRatio: 1.6,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  selfiePlaceholder: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  actionButton: {
    width: '100%',
    marginTop: 16,
  },
  secondaryAction: {
    width: '100%',
    marginTop: 12,
  },
});
