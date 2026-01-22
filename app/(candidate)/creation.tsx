import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, Pressable, Alert } from 'react-native';
import { Text, useTheme, SegmentedButtons, IconButton, Divider, TextInput, Modal, Portal } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Slider from '@react-native-community/slider';

import { useAuthStore, useCandidateStore, useConfigStore } from '@/stores';
import { uploadProfilePhoto, uploadPSAVideo, uploadPSAThumbnail } from '@/services/firebase/storage';
import {
  PrimaryButton,
  SecondaryButton,
  Card,
  Input,
  UserAvatar,
  LoadingOverlay,
} from '@/components/ui';
import type { TopIssue } from '@/types';

type EditorTab = 'profile' | 'issues' | 'psas';

export default function CreationScreen() {
  const theme = useTheme();
  const { user } = useAuthStore();
  const {
    candidate,
    psas,
    fetchCandidateByUser,
    fetchPSAs,
    updateCandidateProfile,
    createNewPSA,
    isLoading,
  } = useCandidateStore();
  const { issues } = useConfigStore();

  const [activeTab, setActiveTab] = useState<EditorTab>('profile');
  const [uploading, setUploading] = useState(false);

  // Profile form state
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  // PSA form state
  const [newPsaTitle, setNewPsaTitle] = useState('');
  const [newPsaDescription, setNewPsaDescription] = useState('');
  const [newPsaVideo, setNewPsaVideo] = useState<{ uri: string; name: string } | null>(null);

  // Issues editing state
  const [editingIssue, setEditingIssue] = useState<TopIssue | null>(null);
  const [editPosition, setEditPosition] = useState('');
  const [editSpectrum, setEditSpectrum] = useState(0);
  const [issuePositions, setIssuePositions] = useState<TopIssue[]>([]);

  useEffect(() => {
    if (user?.id) {
      fetchCandidateByUser(user.id);
    }
  }, [user?.id]);

  useEffect(() => {
    if (candidate?.id) {
      fetchPSAs(candidate.id);
      setDisplayName(user?.displayName || '');
      setBio(candidate.bio?.summary || '');

      // Initialize issue positions from candidate data or create empty ones for all issues
      if (candidate.topIssues && candidate.topIssues.length > 0) {
        setIssuePositions(candidate.topIssues);
      } else {
        // Create empty positions for all issues
        const emptyPositions: TopIssue[] = issues.map((issue, index) => ({
          issueId: issue.id,
          position: '',
          priority: index + 1,
          spectrumPosition: 0,
        }));
        setIssuePositions(emptyPositions);
      }
    }
  }, [candidate?.id, issues]);

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handlePickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setNewPsaVideo({
        uri: result.assets[0].uri,
        name: result.assets[0].fileName || 'video.mp4',
      });
    }
  };

  const handleSaveProfile = async () => {
    if (!candidate?.id || !user?.id) return;

    setUploading(true);
    try {
      let photoUrl: string | undefined = candidate.bio?.summary;

      if (photoUri) {
        const uploadResult = await uploadProfilePhoto(user.id, photoUri);
        if (uploadResult.success && uploadResult.url) {
          photoUrl = uploadResult.url;
        }
      }

      await updateCandidateProfile(candidate.id, {
        bio: {
          ...candidate.bio,
          summary: bio,
        },
      });
    } catch (error) {
      console.error('Error saving profile:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleCreatePSA = async () => {
    if (!candidate?.id || !newPsaVideo) return;

    setUploading(true);
    try {
      const psaId = `psa_${Date.now()}`;
      const videoResult = await uploadPSAVideo(candidate.id, psaId, newPsaVideo.uri);

      if (videoResult.success) {
        await createNewPSA({
          candidateId: candidate.id,
          title: newPsaTitle,
          description: newPsaDescription,
          videoUrl: videoResult.url!,
          thumbnailUrl: '',
          duration: 0,
          status: 'draft',
          issueIds: [],
          views: 0,
          likes: 0,
        });

        // Reset form
        setNewPsaTitle('');
        setNewPsaDescription('');
        setNewPsaVideo(null);
      }
    } catch (error) {
      console.error('Error creating PSA:', error);
    } finally {
      setUploading(false);
    }
  };

  const renderProfileTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.photoSection}>
        <Pressable onPress={handlePickImage} style={styles.photoContainer}>
          <UserAvatar
            photoUrl={photoUri || user?.photoUrl || undefined}
            displayName={displayName || 'Candidate'}
            size={120}
          />
          <View style={[styles.editBadge, { backgroundColor: theme.colors.primary }]}>
            <MaterialCommunityIcons name="camera" size={20} color="white" />
          </View>
        </Pressable>
        <Text variant="bodySmall" style={{ color: theme.colors.outline, marginTop: 8 }}>
          Tap to change photo
        </Text>
      </View>

      <Input
        label="Display Name"
        value={displayName}
        onChangeText={setDisplayName}
        style={styles.inputField}
      />

      <Input
        label="Bio / Summary"
        value={bio}
        onChangeText={setBio}
        multiline
        numberOfLines={4}
        style={styles.inputField}
      />

      <PrimaryButton
        onPress={handleSaveProfile}
        loading={isLoading || uploading}
        style={styles.saveButton}
      >
        Save Changes
      </PrimaryButton>
    </ScrollView>
  );

  const handleEditIssue = (topIssue: TopIssue) => {
    setEditingIssue(topIssue);
    setEditPosition(topIssue.position);
    setEditSpectrum(topIssue.spectrumPosition);
  };

  const handleSaveIssueEdit = () => {
    if (!editingIssue) return;

    setIssuePositions((prev) =>
      prev.map((p) =>
        p.issueId === editingIssue.issueId
          ? { ...p, position: editPosition, spectrumPosition: editSpectrum }
          : p
      )
    );
    setEditingIssue(null);
  };

  const handleMovePriority = (issueId: string, direction: 'up' | 'down') => {
    setIssuePositions((prev) => {
      const sorted = [...prev].sort((a, b) => a.priority - b.priority);
      const index = sorted.findIndex((p) => p.issueId === issueId);

      if (direction === 'up' && index > 0) {
        // Swap priorities with the item above
        const temp = sorted[index].priority;
        sorted[index].priority = sorted[index - 1].priority;
        sorted[index - 1].priority = temp;
      } else if (direction === 'down' && index < sorted.length - 1) {
        // Swap priorities with the item below
        const temp = sorted[index].priority;
        sorted[index].priority = sorted[index + 1].priority;
        sorted[index + 1].priority = temp;
      }

      return sorted.sort((a, b) => a.priority - b.priority);
    });
  };

  const handleSaveAllIssues = async () => {
    if (!candidate?.id) return;

    setUploading(true);
    try {
      await updateCandidateProfile(candidate.id, {
        topIssues: issuePositions,
      });
      Alert.alert('Success', 'Your issue positions have been saved.');
    } catch (error) {
      console.error('Error saving issues:', error);
      Alert.alert('Error', 'Failed to save issue positions.');
    } finally {
      setUploading(false);
    }
  };

  const getSpectrumLabel = (value: number) => {
    if (value <= -60) return 'Strongly Progressive';
    if (value <= -20) return 'Progressive';
    if (value <= 20) return 'Moderate';
    if (value <= 60) return 'Conservative';
    return 'Strongly Conservative';
  };

  const renderIssuesTab = () => {
    const sortedPositions = [...issuePositions].sort((a, b) => a.priority - b.priority);

    return (
      <ScrollView style={styles.tabContent}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Your Positions on All Issues
        </Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.outline, marginBottom: 8 }}>
          State your position on each issue. Drag to reorder by priority (most important first).
        </Text>
        <Text variant="labelSmall" style={{ color: theme.colors.primary, marginBottom: 16 }}>
          {issuePositions.filter((p) => p.position).length} of {issues.length} positions completed
        </Text>

        {sortedPositions.map((topIssue, index) => {
          const issue = issues.find((i) => i.id === topIssue.issueId);
          const hasPosition = topIssue.position.length > 0;

          return (
            <Card
              key={topIssue.issueId}
              style={[
                styles.issueCard,
                !hasPosition && { borderLeftWidth: 3, borderLeftColor: theme.colors.error },
              ]}
            >
              <View style={styles.issueCardContent}>
                <View style={styles.priorityControls}>
                  <IconButton
                    icon="chevron-up"
                    size={18}
                    disabled={index === 0}
                    onPress={() => handleMovePriority(topIssue.issueId, 'up')}
                  />
                  <Text variant="titleMedium" style={styles.issueRank}>
                    {index + 1}
                  </Text>
                  <IconButton
                    icon="chevron-down"
                    size={18}
                    disabled={index === sortedPositions.length - 1}
                    onPress={() => handleMovePriority(topIssue.issueId, 'down')}
                  />
                </View>
                <View style={styles.issueInfo}>
                  <Text variant="titleSmall">{issue?.name || topIssue.issueId}</Text>
                  {hasPosition ? (
                    <Text
                      variant="bodySmall"
                      style={{ color: theme.colors.outline }}
                      numberOfLines={2}
                    >
                      {topIssue.position}
                    </Text>
                  ) : (
                    <Text variant="bodySmall" style={{ color: theme.colors.error }}>
                      Position required
                    </Text>
                  )}
                  <Text
                    variant="labelSmall"
                    style={{ color: theme.colors.primary, marginTop: 4 }}
                  >
                    {getSpectrumLabel(topIssue.spectrumPosition)}
                  </Text>
                </View>
                <IconButton
                  icon="pencil"
                  onPress={() => handleEditIssue(topIssue)}
                />
              </View>
            </Card>
          );
        })}

        <PrimaryButton
          onPress={handleSaveAllIssues}
          loading={uploading}
          style={{ marginTop: 16, marginBottom: 32 }}
        >
          Save All Positions
        </PrimaryButton>

        {/* Edit Issue Modal */}
        <Portal>
          <Modal
            visible={!!editingIssue}
            onDismiss={() => setEditingIssue(null)}
            contentContainerStyle={[
              styles.modalContent,
              { backgroundColor: theme.colors.surface },
            ]}
          >
            <Text variant="titleLarge" style={{ fontWeight: 'bold', marginBottom: 16 }}>
              {issues.find((i) => i.id === editingIssue?.issueId)?.name}
            </Text>

            <Text variant="labelMedium" style={{ marginBottom: 8 }}>
              Your Position
            </Text>
            <TextInput
              mode="outlined"
              value={editPosition}
              onChangeText={setEditPosition}
              multiline
              numberOfLines={4}
              placeholder="Describe your position on this issue..."
              style={{ marginBottom: 16 }}
            />

            <Text variant="labelMedium" style={{ marginBottom: 8 }}>
              Political Spectrum: {getSpectrumLabel(editSpectrum)}
            </Text>
            <View style={styles.spectrumSliderContainer}>
              <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
                Progressive
              </Text>
              <Slider
                style={styles.spectrumSlider}
                minimumValue={-100}
                maximumValue={100}
                step={5}
                value={editSpectrum}
                onValueChange={setEditSpectrum}
                minimumTrackTintColor={theme.colors.primary}
                maximumTrackTintColor={theme.colors.surfaceVariant}
              />
              <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
                Conservative
              </Text>
            </View>

            <View style={styles.modalButtons}>
              <SecondaryButton
                onPress={() => setEditingIssue(null)}
                style={{ flex: 1, marginRight: 8 }}
              >
                Cancel
              </SecondaryButton>
              <PrimaryButton
                onPress={handleSaveIssueEdit}
                style={{ flex: 1, marginLeft: 8 }}
                disabled={!editPosition.trim()}
              >
                Save
              </PrimaryButton>
            </View>
          </Modal>
        </Portal>
      </ScrollView>
    );
  };

  const renderPSAsTab = () => (
    <ScrollView style={styles.tabContent}>
      <Text variant="titleMedium" style={styles.sectionTitle}>
        Create New PSA
      </Text>

      <Input
        label="Title"
        value={newPsaTitle}
        onChangeText={setNewPsaTitle}
        style={styles.inputField}
      />

      <Input
        label="Description"
        value={newPsaDescription}
        onChangeText={setNewPsaDescription}
        multiline
        numberOfLines={3}
        style={styles.inputField}
      />

      <Card
        style={styles.videoUploadCard}
        onPress={handlePickVideo}
      >
        <View style={styles.videoUploadContent}>
          <MaterialCommunityIcons
            name={newPsaVideo ? 'video-check' : 'video-plus'}
            size={48}
            color={newPsaVideo ? theme.colors.primary : theme.colors.outline}
          />
          <Text variant="titleSmall">
            {newPsaVideo ? newPsaVideo.name : 'Upload Video'}
          </Text>
        </View>
      </Card>

      <PrimaryButton
        onPress={handleCreatePSA}
        disabled={!newPsaTitle || !newPsaVideo}
        loading={uploading}
        style={styles.createButton}
      >
        Create PSA
      </PrimaryButton>

      <Divider style={styles.divider} />

      <Text variant="titleMedium" style={styles.sectionTitle}>
        Your PSAs
      </Text>

      {psas.map((psa) => (
        <Card key={psa.id} style={styles.psaCard}>
          <View style={styles.psaCardContent}>
            <View style={[styles.psaThumbnail, { backgroundColor: theme.colors.surfaceVariant }]}>
              <MaterialCommunityIcons
                name="video"
                size={24}
                color={theme.colors.outline}
              />
            </View>
            <View style={styles.psaInfo}>
              <Text variant="titleSmall">{psa.title}</Text>
              <View style={styles.psaStats}>
                <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                  {psa.views} views
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                  • {psa.status}
                </Text>
              </View>
            </View>
            <IconButton icon="dots-vertical" onPress={() => {}} />
          </View>
        </Card>
      ))}

      {psas.length === 0 && (
        <Text variant="bodyMedium" style={{ color: theme.colors.outline, textAlign: 'center' }}>
          No PSAs created yet
        </Text>
      )}
    </ScrollView>
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['bottom']}
    >
      <LoadingOverlay visible={uploading} message="Uploading..." />

      <View style={styles.header}>
        <SegmentedButtons
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as EditorTab)}
          buttons={[
            { value: 'profile', label: 'Profile', icon: 'account' },
            { value: 'issues', label: 'Issues', icon: 'clipboard-list' },
            { value: 'psas', label: 'PSAs', icon: 'video' },
          ]}
        />
      </View>

      {activeTab === 'profile' && renderProfileTab()}
      {activeTab === 'issues' && renderIssuesTab()}
      {activeTab === 'psas' && renderPSAsTab()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
  },
  tabContent: {
    flex: 1,
    padding: 16,
    paddingTop: 0,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  photoContainer: {
    position: 'relative',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputField: {
    marginBottom: 16,
  },
  saveButton: {
    marginTop: 8,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  issueCard: {
    marginBottom: 12,
  },
  issueCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
  },
  priorityControls: {
    alignItems: 'center',
    marginRight: 8,
  },
  issueRank: {
    fontWeight: 'bold',
    width: 30,
    textAlign: 'center',
  },
  issueInfo: {
    flex: 1,
  },
  modalContent: {
    margin: 20,
    padding: 20,
    borderRadius: 12,
  },
  spectrumSliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  spectrumSlider: {
    flex: 1,
    marginHorizontal: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: 8,
  },
  emptyCard: {
    padding: 32,
  },
  emptyContent: {
    alignItems: 'center',
  },
  videoUploadCard: {
    padding: 24,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'transparent',
    marginBottom: 16,
  },
  videoUploadContent: {
    alignItems: 'center',
  },
  createButton: {
    marginBottom: 16,
  },
  divider: {
    marginVertical: 24,
  },
  psaCard: {
    marginBottom: 12,
  },
  psaCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
  },
  psaThumbnail: {
    width: 60,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  psaInfo: {
    flex: 1,
    marginLeft: 12,
  },
  psaStats: {
    flexDirection: 'row',
    marginTop: 4,
  },
});
