import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { StyleSheet, View, ScrollView, Alert, Pressable, Platform } from 'react-native';
import { Text, useTheme, ProgressBar, Checkbox, TextInput, IconButton, Modal, Portal } from 'react-native-paper';
import { SafeAreaView as NativeSafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import Slider from '@react-native-community/slider';

import { useAuthStore, useCandidateStore, useConfigStore } from '@/stores';
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
import type { TopIssue, Issue } from '@/types';

const SafeAreaView = Platform.OS === 'web' ? View : NativeSafeAreaView;

// Separate modal component to manage its own state and prevent re-render issues
interface IssueEditModalProps {
  visible: boolean;
  issue: Issue | undefined;
  initialPosition: string;
  initialSpectrum: number;
  onDismiss: () => void;
  onSave: (position: string, spectrum: number) => void;
}

const IssueEditModal = memo(function IssueEditModal({
  visible,
  issue,
  initialPosition,
  initialSpectrum,
  onDismiss,
  onSave,
}: IssueEditModalProps) {
  const theme = useTheme();
  const positionRef = useRef(initialPosition);
  const [spectrum, setSpectrum] = useState(initialSpectrum);
  const [hasContent, setHasContent] = useState(initialPosition.trim().length > 0);
  const inputKey = useRef(0);

  // Reset when modal opens with new issue
  useEffect(() => {
    if (visible) {
      positionRef.current = initialPosition;
      setSpectrum(initialSpectrum);
      setHasContent(initialPosition.trim().length > 0);
      inputKey.current += 1; // Force TextInput to remount with new defaultValue
    }
  }, [visible, issue?.id]);

  const getSpectrumLabel = (value: number) => {
    if (value <= -60) return 'Strongly Progressive';
    if (value <= -20) return 'Progressive';
    if (value <= 20) return 'Moderate';
    if (value <= 60) return 'Conservative';
    return 'Strongly Conservative';
  };

  const handleTextChange = (text: string) => {
    positionRef.current = text;
    setHasContent(text.trim().length > 0);
  };

  const handleSave = () => {
    onSave(positionRef.current, spectrum);
  };

  if (!visible || !issue) return null;

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        dismissable={false}
        dismissableBackButton={false}
        contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}
      >
        <View style={{ flex: 1, maxHeight: '100%' }}>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }}>
            <Text variant="titleLarge" style={styles.modalTitle}>
              {issue.name}
            </Text>

            <Text variant="bodyMedium" style={{ color: theme.colors.outline, marginBottom: 16 }}>
              {issue.description}
            </Text>

            <TextInput
              key={inputKey.current}
              label="Your Position"
              defaultValue={initialPosition}
              onChangeText={handleTextChange}
              multiline
              numberOfLines={4}
              mode="outlined"
              placeholder="Describe your stance on this issue..."
              style={styles.positionInput}
            />

            <Text variant="titleSmall" style={{ marginTop: 16, marginBottom: 8 }}>
              Political Spectrum: {getSpectrumLabel(spectrum)}
            </Text>
            <View style={styles.spectrumContainer}>
              <Text variant="labelSmall">Progressive</Text>
              <Slider
                style={styles.slider}
                minimumValue={-100}
                maximumValue={100}
                value={spectrum}
                onSlidingComplete={setSpectrum}
                step={1}
                minimumTrackTintColor={theme.colors.primary}
                maximumTrackTintColor={theme.colors.surfaceVariant}
                thumbTintColor={theme.colors.primary}
              />
              <Text variant="labelSmall">Conservative</Text>
            </View>
          </ScrollView>

          <View style={styles.modalButtons}>
            <SecondaryButton onPress={onDismiss} style={{ flex: 1 }}>
              Cancel
            </SecondaryButton>
            <PrimaryButton
              onPress={handleSave}
              disabled={!hasContent}
              style={{ flex: 1 }}
            >
              Save
            </PrimaryButton>
          </View>
        </View>
      </Modal>
    </Portal>
  );
});

type ApplicationStep = 'intro' | 'signatures' | 'documents' | 'issues' | 'declaration' | 'review';

export default function ApplyScreen() {
  const theme = useTheme();
  const { user } = useAuthStore();
  const { submitApplication, isLoading } = useCandidateStore();
  const { issues } = useConfigStore();

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

  // Issue positions state
  const [issuePositions, setIssuePositions] = useState<TopIssue[]>([]);
  const [editingIssue, setEditingIssue] = useState<TopIssue | null>(null);

  // Initialize issue positions when issues load
  useEffect(() => {
    if (issues.length > 0 && issuePositions.length === 0) {
      const initialPositions: TopIssue[] = issues.map((issue, index) => ({
        issueId: issue.id,
        position: '',
        priority: index + 1,
        spectrumPosition: 0,
      }));
      setIssuePositions(initialPositions);
    }
  }, [issues]);

  const getProgress = () => {
    switch (currentStep) {
      case 'intro':
        return 0;
      case 'signatures':
        return 0.17;
      case 'documents':
        return 0.33;
      case 'issues':
        return 0.5;
      case 'declaration':
        return 0.67;
      case 'review':
        return 1;
      default:
        return 0;
    }
  };

  // Issue editing helpers
  const handleEditIssue = useCallback((topIssue: TopIssue) => {
    setEditingIssue(topIssue);
  }, []);

  const handleSaveIssueEdit = useCallback((position: string, spectrum: number) => {
    if (!editingIssue) return;

    setIssuePositions((prev) =>
      prev.map((p) =>
        p.issueId === editingIssue.issueId
          ? { ...p, position, spectrumPosition: spectrum }
          : p
      )
    );
    setEditingIssue(null);
  }, [editingIssue]);

  const handleDismissEditModal = useCallback(() => {
    setEditingIssue(null);
  }, []);

  const handleMovePriority = (issueId: string, direction: 'up' | 'down') => {
    setIssuePositions((prev) => {
      const sorted = [...prev].sort((a, b) => a.priority - b.priority);
      const index = sorted.findIndex((p) => p.issueId === issueId);

      if (direction === 'up' && index > 0) {
        const temp = sorted[index].priority;
        sorted[index].priority = sorted[index - 1].priority;
        sorted[index - 1].priority = temp;
      } else if (direction === 'down' && index < sorted.length - 1) {
        const temp = sorted[index].priority;
        sorted[index].priority = sorted[index + 1].priority;
        sorted[index + 1].priority = temp;
      }

      return sorted.sort((a, b) => a.priority - b.priority);
    });
  };

  const completedPositions = issuePositions.filter((p) => p.position.length > 0).length;
  const hasMinimumPositions = completedPositions >= 5; // Require at least 5 positions

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
    if (!user?.id || !signatureDoc || !idDoc) {
      Alert.alert('Missing Information', 'Please ensure all required documents are uploaded.');
      return;
    }

    setUploading(true);
    try {
      // Upload documents
      console.log('Uploading signature doc:', signatureDoc.uri);
      const signatureResult = await uploadSignatureDoc(user.id, signatureDoc.uri);
      if (!signatureResult.success) {
        throw new Error(`Signature upload failed: ${signatureResult.error || 'Unknown error'}`);
      }

      console.log('Uploading ID doc:', idDoc.uri);
      const idResult = await uploadIdDoc(user.id, idDoc.uri);
      if (!idResult.success) {
        throw new Error(`ID upload failed: ${idResult.error || 'Unknown error'}`);
      }

      let resumeUrl = '';
      if (resumeDoc) {
        console.log('Uploading resume:', resumeDoc.uri);
        const resumeResult = await uploadResume(user.id, resumeDoc.uri);
        if (!resumeResult.success) {
          console.warn('Resume upload failed:', resumeResult.error);
          // Resume is optional, so we continue
        } else {
          resumeUrl = resumeResult.url || '';
        }
      }

      console.log('Submitting application...');
      // Submit application - Firestore doesn't accept undefined values
      const applicationData: any = {
        userId: user.id,
        status: 'pending',
        signatureDocUrl: signatureResult.url!,
        idDocUrl: idResult.url!,
        criminalHistoryDisclosure: {
          hasConvictions,
          hasArrestHistory: false,
        },
        declarationOfIntent: {
          fullLegalName: user.displayName || '',
          dateOfBirth: '',
          ssn: '',
          address: '',
          agreedToTerms,
          signatureDataUrl: '',
          signedAt: new Date(),
        },
      };

      // Only add optional fields if they have values
      if (resumeUrl) {
        applicationData.resumeUrl = resumeUrl;
      }
      if (hasConvictions && convictionDetails) {
        applicationData.criminalHistoryDisclosure.convictionDetails = convictionDetails;
      }

      // Add policy positions - only include ones with content
      const completedIssuePositions = issuePositions
        .filter((p) => p.position.length > 0)
        .sort((a, b) => a.priority - b.priority);

      if (completedIssuePositions.length > 0) {
        applicationData.topIssues = completedIssuePositions;
      }

      // Add reason for running
      if (reasonForRunning) {
        applicationData.reasonForRunning = reasonForRunning;
      }

      const applicationId = await submitApplication(user.id, applicationData);

      if (!applicationId) {
        throw new Error('Failed to create application. Please try again.');
      }

      Alert.alert(
        'Application Submitted',
        'Your application has been submitted successfully. We will review it and notify you of the outcome.',
        [{ text: 'OK', onPress: () => router.replace('/(tabs)/profile') }]
      );
    } catch (error: any) {
      console.error('Error submitting application:', error);
      Alert.alert(
        'Submission Failed',
        error.message || 'An unexpected error occurred. Please try again.',
        [{ text: 'OK' }]
      );
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

      <View style={styles.introButtons}>
        <SecondaryButton
          onPress={() => router.back()}
          style={styles.introCancelButton}
        >
          Cancel
        </SecondaryButton>
        <PrimaryButton
          onPress={() => setCurrentStep('signatures')}
          style={styles.introStartButton}
        >
          Start Application
        </PrimaryButton>
      </View>
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
          onPress={() => setCurrentStep('issues')}
          disabled={!idDoc}
          style={styles.navButton}
        >
          Continue
        </PrimaryButton>
      </View>
    </View>
  );

  const renderIssuesStep = () => {
    const sortedPositions = [...issuePositions].sort((a, b) => a.priority - b.priority);

    return (
      <View style={styles.stepContent}>
        <Text variant="headlineSmall" style={styles.stepTitle}>
          Policy Positions
        </Text>
        <Text
          variant="bodyMedium"
          style={[styles.stepDescription, { color: theme.colors.outline }]}
        >
          State your position on key issues. Voters will see these to understand where you stand.
          Complete at least 5 positions to continue.
        </Text>

        <View style={styles.progressIndicator}>
          <Text
            variant="titleMedium"
            style={{ color: hasMinimumPositions ? theme.colors.primary : theme.colors.error }}
          >
            {completedPositions} of {issues.length} positions completed
          </Text>
          {!hasMinimumPositions && (
            <Text variant="bodySmall" style={{ color: theme.colors.error }}>
              (minimum 5 required)
            </Text>
          )}
        </View>

        <ScrollView style={styles.issuesList} showsVerticalScrollIndicator={false}>
          {sortedPositions.map((topIssue, index) => {
            const issue = issues.find((i) => i.id === topIssue.issueId);
            const hasPosition = topIssue.position.length > 0;

            return (
              <Card
                key={topIssue.issueId}
                style={[
                  styles.issueCard,
                  !hasPosition && { borderLeftWidth: 3, borderLeftColor: theme.colors.outline },
                  hasPosition && { borderLeftWidth: 3, borderLeftColor: theme.colors.primary },
                ]}
              >
                <View style={styles.issueCardContent}>
                  <View style={styles.priorityControls}>
                    <IconButton
                      icon="chevron-up"
                      size={16}
                      disabled={index === 0}
                      onPress={() => handleMovePriority(topIssue.issueId, 'up')}
                    />
                    <Text variant="labelLarge" style={styles.issueRank}>
                      #{index + 1}
                    </Text>
                    <IconButton
                      icon="chevron-down"
                      size={16}
                      disabled={index === sortedPositions.length - 1}
                      onPress={() => handleMovePriority(topIssue.issueId, 'down')}
                    />
                  </View>
                  <Pressable
                    style={styles.issueInfo}
                    onPress={() => handleEditIssue(topIssue)}
                  >
                    <Text variant="titleSmall">{issue?.name || topIssue.issueId}</Text>
                    {hasPosition ? (
                      <Text
                        variant="bodySmall"
                        numberOfLines={2}
                        style={{ color: theme.colors.outline, marginTop: 4 }}
                      >
                        {topIssue.position}
                      </Text>
                    ) : (
                      <Text
                        variant="bodySmall"
                        style={{ color: theme.colors.error, marginTop: 4, fontStyle: 'italic' }}
                      >
                        Tap to add your position
                      </Text>
                    )}
                  </Pressable>
                  <IconButton
                    icon="pencil"
                    size={20}
                    onPress={() => handleEditIssue(topIssue)}
                  />
                </View>
              </Card>
            );
          })}
        </ScrollView>

        <View style={styles.navigationButtons}>
          <SecondaryButton
            onPress={() => setCurrentStep('documents')}
            style={styles.navButton}
          >
            Back
          </SecondaryButton>
          <PrimaryButton
            onPress={() => setCurrentStep('declaration')}
            disabled={!hasMinimumPositions}
            style={styles.navButton}
          >
            Continue
          </PrimaryButton>
        </View>

        {/* Edit Issue Modal */}
        <IssueEditModal
          visible={editingIssue !== null}
          issue={editingIssue ? issues.find((i) => i.id === editingIssue.issueId) : undefined}
          initialPosition={editingIssue?.position || ''}
          initialSpectrum={editingIssue?.spectrumPosition || 0}
          onDismiss={handleDismissEditModal}
          onSave={handleSaveIssueEdit}
        />
      </View>
    );
  };

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
          onPress={() => setCurrentStep('issues')}
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

  const renderReviewStep = () => {
    const topPositions = [...issuePositions]
      .filter((p) => p.position.length > 0)
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 5);

    return (
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

      <Card style={styles.reviewCard}>
        <Text variant="titleSmall">Policy Positions ({completedPositions} completed)</Text>
        {topPositions.map((pos, index) => {
          const issue = issues.find((i) => i.id === pos.issueId);
          return (
            <View key={pos.issueId} style={styles.reviewItem}>
              <Text variant="labelMedium" style={{ color: theme.colors.primary, width: 24 }}>
                #{index + 1}
              </Text>
              <View style={{ flex: 1 }}>
                <Text variant="bodyMedium">{issue?.name || pos.issueId}</Text>
                <Text
                  variant="bodySmall"
                  numberOfLines={1}
                  style={{ color: theme.colors.outline }}
                >
                  {pos.position}
                </Text>
              </View>
            </View>
          );
        })}
        {completedPositions > 5 && (
          <Text variant="bodySmall" style={{ color: theme.colors.outline, marginTop: 8 }}>
            +{completedPositions - 5} more positions
          </Text>
        )}
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
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'intro':
        return renderIntroStep();
      case 'signatures':
        return renderSignaturesStep();
      case 'documents':
        return renderDocumentsStep();
      case 'issues':
        return renderIssuesStep();
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
  introButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 'auto',
  },
  introCancelButton: {
    flex: 1,
  },
  introStartButton: {
    flex: 1,
  },
  // Issues step styles
  progressIndicator: {
    marginBottom: 16,
    alignItems: 'center',
  },
  issuesList: {
    flex: 1,
    marginBottom: 16,
  },
  issueCard: {
    marginBottom: 8,
    padding: 8,
  },
  issueCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priorityControls: {
    alignItems: 'center',
    width: 40,
  },
  issueRank: {
    fontWeight: 'bold',
  },
  issueInfo: {
    flex: 1,
    paddingHorizontal: 8,
  },
  // Modal styles
  modal: {
    margin: 20,
    padding: 20,
    borderRadius: 12,
    maxHeight: '85%',
    minHeight: 400,
  },
  modalTitle: {
    fontWeight: 'bold',
    marginBottom: 12,
  },
  positionInput: {
    marginBottom: 8,
  },
  spectrumContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  slider: {
    flex: 1,
    marginHorizontal: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
});
