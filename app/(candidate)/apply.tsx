import React, { useState } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { Text, useTheme, ProgressBar, Checkbox, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';

import { useAuthStore, useCandidateStore } from '@/stores';
import {
  uploadSignatureDoc,
  uploadIdDoc,
  uploadResume,
} from '@/services/firebase/storage';
import {
  PrimaryButton,
  SecondaryButton,
  Card,
  Input,
  LoadingOverlay,
} from '@/components/ui';

type ApplicationStep = 'intro' | 'signatures' | 'documents' | 'declaration' | 'review';

export default function ApplyScreen() {
  const theme = useTheme();
  const { user } = useAuthStore();
  const { submitApplication, isLoading } = useCandidateStore();

  const [currentStep, setCurrentStep] = useState<ApplicationStep>('intro');
  const [uploading, setUploading] = useState(false);

  // Form state
  const [signatureDoc, setSignatureDoc] = useState<{ uri: string; name: string } | null>(null);
  const [idDoc, setIdDoc] = useState<{ uri: string; name: string } | null>(null);
  const [resumeDoc, setResumeDoc] = useState<{ uri: string; name: string } | null>(null);
  const [reasonForRunning, setReasonForRunning] = useState('');
  const [hasConvictions, setHasConvictions] = useState(false);
  const [convictionDetails, setConvictionDetails] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToTruthfulness, setAgreedToTruthfulness] = useState(false);

  const getProgress = () => {
    switch (currentStep) {
      case 'intro':
        return 0;
      case 'signatures':
        return 0.25;
      case 'documents':
        return 0.5;
      case 'declaration':
        return 0.75;
      case 'review':
        return 1;
      default:
        return 0;
    }
  };

  const handleDocumentPick = async (
    type: 'signature' | 'id' | 'resume',
    setter: (doc: { uri: string; name: string } | null) => void
  ) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        setter({
          uri: result.assets[0].uri,
          name: result.assets[0].name,
        });
      }
    } catch (error) {
      console.error('Error picking document:', error);
    }
  };

  const handleSubmit = async () => {
    if (!user?.id || !signatureDoc || !idDoc) return;

    setUploading(true);
    try {
      // Upload documents
      const [signatureResult, idResult, resumeResult] = await Promise.all([
        uploadSignatureDoc(user.id, signatureDoc.uri),
        uploadIdDoc(user.id, idDoc.uri),
        resumeDoc ? uploadResume(user.id, resumeDoc.uri) : Promise.resolve({ success: true, url: '' }),
      ]);

      if (!signatureResult.success || !idResult.success) {
        throw new Error('Failed to upload documents');
      }

      // Submit application
      await submitApplication(user.id, {
        userId: user.id,
        status: 'pending',
        signatureDocUrl: signatureResult.url!,
        idDocUrl: idResult.url!,
        resumeUrl: resumeResult.url || undefined,
        criminalHistoryDisclosure: {
          hasConvictions,
          convictionDetails: hasConvictions ? convictionDetails : undefined,
          hasArrestHistory: false,
        },
        declarationOfIntent: {
          fullLegalName: user.displayName || '',
          dateOfBirth: '',
          ssn: '',
          address: '',
          agreedToTerms,
          signatureDataUrl: '',
          signedAt: {} as any,
        },
      });

      router.replace('/(tabs)/profile');
    } catch (error) {
      console.error('Error submitting application:', error);
    } finally {
      setUploading(false);
    }
  };

  const renderIntroStep = () => (
    <View style={styles.stepContent}>
      <MaterialCommunityIcons
        name="podium"
        size={80}
        color={theme.colors.primary}
        style={styles.icon}
      />
      <Text variant="headlineSmall" style={styles.stepTitle}>
        Run for Office
      </Text>
      <Text
        variant="bodyLarge"
        style={[styles.stepDescription, { color: theme.colors.outline }]}
      >
        Thank you for your interest in running for office. This application process ensures that all candidates meet our requirements for participation.
      </Text>

      <View style={styles.requirementsList}>
        <Text variant="titleMedium" style={styles.requirementsTitle}>
          Requirements:
        </Text>
        {[
          'Collect 100 supporter signatures',
          'Government-issued photo ID',
          'Declaration of intent',
          'Criminal history disclosure',
        ].map((req, index) => (
          <View key={index} style={styles.requirementItem}>
            <MaterialCommunityIcons
              name="check-circle-outline"
              size={20}
              color={theme.colors.primary}
            />
            <Text variant="bodyMedium" style={styles.requirementText}>
              {req}
            </Text>
          </View>
        ))}
      </View>

      <PrimaryButton
        onPress={() => setCurrentStep('signatures')}
        style={styles.actionButton}
      >
        Start Application
      </PrimaryButton>
    </View>
  );

  const renderSignaturesStep = () => (
    <View style={styles.stepContent}>
      <Text variant="headlineSmall" style={styles.stepTitle}>
        Supporter Signatures
      </Text>
      <Text
        variant="bodyLarge"
        style={[styles.stepDescription, { color: theme.colors.outline }]}
      >
        Upload a PDF containing 100 supporter signatures. Each signature should include the supporter's printed name, signature, and date.
      </Text>

      <Card
        style={signatureDoc ? [styles.uploadCard, { borderColor: theme.colors.primary }] : styles.uploadCard}
        onPress={() => handleDocumentPick('signature', setSignatureDoc)}
      >
        <View style={styles.uploadContent}>
          <MaterialCommunityIcons
            name={signatureDoc ? 'file-check' : 'file-upload'}
            size={48}
            color={signatureDoc ? theme.colors.primary : theme.colors.outline}
          />
          <Text
            variant="titleSmall"
            style={{ color: signatureDoc ? theme.colors.primary : theme.colors.onSurface }}
          >
            {signatureDoc ? signatureDoc.name : 'Upload Signature Document'}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
            PDF or scanned images accepted
          </Text>
        </View>
      </Card>

      <View style={styles.navigationButtons}>
        <SecondaryButton
          onPress={() => setCurrentStep('intro')}
          style={styles.navButton}
        >
          Back
        </SecondaryButton>
        <PrimaryButton
          onPress={() => setCurrentStep('documents')}
          disabled={!signatureDoc}
          style={styles.navButton}
        >
          Continue
        </PrimaryButton>
      </View>
    </View>
  );

  const renderDocumentsStep = () => (
    <View style={styles.stepContent}>
      <Text variant="headlineSmall" style={styles.stepTitle}>
        Required Documents
      </Text>
      <Text
        variant="bodyLarge"
        style={[styles.stepDescription, { color: theme.colors.outline }]}
      >
        Upload your government-issued photo ID and optional supporting documents.
      </Text>

      <Card
        style={idDoc ? [styles.uploadCard, { borderColor: theme.colors.primary }] : styles.uploadCard}
        onPress={() => handleDocumentPick('id', setIdDoc)}
      >
        <View style={styles.uploadContent}>
          <MaterialCommunityIcons
            name={idDoc ? 'file-check' : 'card-account-details'}
            size={48}
            color={idDoc ? theme.colors.primary : theme.colors.outline}
          />
          <Text variant="titleSmall">
            {idDoc ? idDoc.name : 'Government ID *'}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
            Driver's license, passport, or state ID
          </Text>
        </View>
      </Card>

      <Card
        style={resumeDoc ? [styles.uploadCard, { borderColor: theme.colors.primary }] : styles.uploadCard}
        onPress={() => handleDocumentPick('resume', setResumeDoc)}
      >
        <View style={styles.uploadContent}>
          <MaterialCommunityIcons
            name={resumeDoc ? 'file-check' : 'file-document'}
            size={48}
            color={resumeDoc ? theme.colors.primary : theme.colors.outline}
          />
          <Text variant="titleSmall">
            {resumeDoc ? resumeDoc.name : 'Resume (Optional)'}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
            Share your background and experience
          </Text>
        </View>
      </Card>

      <View style={styles.navigationButtons}>
        <SecondaryButton
          onPress={() => setCurrentStep('signatures')}
          style={styles.navButton}
        >
          Back
        </SecondaryButton>
        <PrimaryButton
          onPress={() => setCurrentStep('declaration')}
          disabled={!idDoc}
          style={styles.navButton}
        >
          Continue
        </PrimaryButton>
      </View>
    </View>
  );

  const renderDeclarationStep = () => (
    <ScrollView style={styles.scrollStep}>
      <Text variant="headlineSmall" style={styles.stepTitle}>
        Declaration of Intent
      </Text>
      <Text
        variant="bodyLarge"
        style={[styles.stepDescription, { color: theme.colors.outline }]}
      >
        Please provide the following information and disclosures.
      </Text>

      <Input
        label="Why are you running for office?"
        value={reasonForRunning}
        onChangeText={setReasonForRunning}
        multiline
        numberOfLines={4}
        style={styles.inputField}
      />

      <Card style={styles.disclosureCard}>
        <Text variant="titleSmall" style={styles.disclosureTitle}>
          Criminal History Disclosure
        </Text>
        <View style={styles.checkboxRow}>
          <Checkbox
            status={hasConvictions ? 'checked' : 'unchecked'}
            onPress={() => setHasConvictions(!hasConvictions)}
          />
          <Text variant="bodyMedium" style={styles.checkboxLabel}>
            I have been convicted of a crime
          </Text>
        </View>
        {hasConvictions && (
          <Input
            label="Please provide details"
            value={convictionDetails}
            onChangeText={setConvictionDetails}
            multiline
            numberOfLines={3}
            style={styles.inputField}
          />
        )}
      </Card>

      <Card style={styles.agreementCard}>
        <View style={styles.checkboxRow}>
          <Checkbox
            status={agreedToTerms ? 'checked' : 'unchecked'}
            onPress={() => setAgreedToTerms(!agreedToTerms)}
          />
          <Text variant="bodyMedium" style={styles.checkboxLabel}>
            I agree to the Terms of Service and Candidate Agreement
          </Text>
        </View>
        <View style={styles.checkboxRow}>
          <Checkbox
            status={agreedToTruthfulness ? 'checked' : 'unchecked'}
            onPress={() => setAgreedToTruthfulness(!agreedToTruthfulness)}
          />
          <Text variant="bodyMedium" style={styles.checkboxLabel}>
            I certify that all information provided is true and accurate
          </Text>
        </View>
      </Card>

      <View style={styles.navigationButtons}>
        <SecondaryButton
          onPress={() => setCurrentStep('documents')}
          style={styles.navButton}
        >
          Back
        </SecondaryButton>
        <PrimaryButton
          onPress={() => setCurrentStep('review')}
          disabled={!reasonForRunning || !agreedToTerms || !agreedToTruthfulness}
          style={styles.navButton}
        >
          Review
        </PrimaryButton>
      </View>
    </ScrollView>
  );

  const renderReviewStep = () => (
    <ScrollView style={styles.scrollStep}>
      <Text variant="headlineSmall" style={styles.stepTitle}>
        Review Application
      </Text>
      <Text
        variant="bodyLarge"
        style={[styles.stepDescription, { color: theme.colors.outline }]}
      >
        Please review your application before submitting.
      </Text>

      <Card style={styles.reviewCard}>
        <Text variant="titleSmall">Documents</Text>
        <View style={styles.reviewItem}>
          <MaterialCommunityIcons name="check" size={20} color={theme.colors.primary} />
          <Text variant="bodyMedium" style={styles.reviewItemText}>
            Signatures: {signatureDoc?.name}
          </Text>
        </View>
        <View style={styles.reviewItem}>
          <MaterialCommunityIcons name="check" size={20} color={theme.colors.primary} />
          <Text variant="bodyMedium" style={styles.reviewItemText}>
            ID: {idDoc?.name}
          </Text>
        </View>
        {resumeDoc && (
          <View style={styles.reviewItem}>
            <MaterialCommunityIcons name="check" size={20} color={theme.colors.primary} />
            <Text variant="bodyMedium" style={styles.reviewItemText}>
              Resume: {resumeDoc.name}
            </Text>
          </View>
        )}
      </Card>

      <Card style={styles.reviewCard}>
        <Text variant="titleSmall">Reason for Running</Text>
        <Text variant="bodyMedium" style={{ marginTop: 8, color: theme.colors.outline }}>
          {reasonForRunning}
        </Text>
      </Card>

      <View style={styles.navigationButtons}>
        <SecondaryButton
          onPress={() => setCurrentStep('declaration')}
          style={styles.navButton}
        >
          Back
        </SecondaryButton>
        <PrimaryButton
          onPress={handleSubmit}
          loading={uploading || isLoading}
          style={styles.navButton}
        >
          Submit Application
        </PrimaryButton>
      </View>
    </ScrollView>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'intro':
        return renderIntroStep();
      case 'signatures':
        return renderSignaturesStep();
      case 'documents':
        return renderDocumentsStep();
      case 'declaration':
        return renderDeclarationStep();
      case 'review':
        return renderReviewStep();
      default:
        return renderIntroStep();
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['bottom']}
    >
      <LoadingOverlay visible={uploading} message="Uploading documents..." />

      {currentStep !== 'intro' && (
        <View style={styles.progressContainer}>
          <ProgressBar
            progress={getProgress()}
            color={theme.colors.primary}
            style={styles.progressBar}
          />
        </View>
      )}

      {renderCurrentStep()}
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
  stepContent: {
    flex: 1,
    padding: 24,
  },
  scrollStep: {
    flex: 1,
    padding: 24,
  },
  icon: {
    alignSelf: 'center',
    marginBottom: 24,
  },
  stepTitle: {
    fontWeight: 'bold',
    marginBottom: 12,
  },
  stepDescription: {
    marginBottom: 24,
  },
  requirementsList: {
    marginBottom: 32,
  },
  requirementsTitle: {
    fontWeight: '600',
    marginBottom: 12,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  requirementText: {
    marginLeft: 12,
  },
  uploadCard: {
    padding: 24,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'transparent',
    marginBottom: 16,
  },
  uploadContent: {
    alignItems: 'center',
  },
  inputField: {
    marginBottom: 16,
  },
  disclosureCard: {
    padding: 16,
    marginBottom: 16,
  },
  disclosureTitle: {
    fontWeight: '600',
    marginBottom: 12,
  },
  agreementCard: {
    padding: 16,
    marginBottom: 24,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkboxLabel: {
    flex: 1,
    marginLeft: 8,
  },
  reviewCard: {
    padding: 16,
    marginBottom: 16,
  },
  reviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  reviewItemText: {
    marginLeft: 8,
  },
  navigationButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 'auto',
  },
  navButton: {
    flex: 1,
  },
  actionButton: {
    marginTop: 'auto',
  },
});
