import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, Pressable, Alert } from 'react-native';
import { Text, useTheme, TextInput } from 'react-native-paper';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { useAuthStore } from '@/stores';
import { PrimaryButton, SecondaryButton, UserAvatar, LoadingOverlay, Card } from '@/components/ui';
import { updateUser } from '@/services/firebase/firestore';
import { uploadProfilePhoto } from '@/services/firebase/storage';

export default function PersonalInfoScreen() {
  const theme = useTheme();
  const { user } = useAuthStore();

  const [displayName, setDisplayName] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setPhotoUrl(user.photoUrl || undefined);
    }
  }, [user]);

  const handlePickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow access to your photo library to change your profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotoUrl(result.assets[0].uri);
      setHasChanges(true);
    }
  };

  const handleNameChange = (text: string) => {
    setDisplayName(text);
    setHasChanges(text !== user?.displayName);
  };

  const handleSave = async () => {
    if (!user?.id) return;

    setIsSaving(true);
    try {
      let finalPhotoUrl = photoUrl;

      // If the photo is a local file URI (newly picked), upload to Storage first
      if (photoUrl && (photoUrl.startsWith('file://') || photoUrl.startsWith('ph://'))) {
        const uploadResult = await uploadProfilePhoto(user.id, photoUrl);
        if (!uploadResult.success) {
          Alert.alert('Upload Failed', uploadResult.error || 'Failed to upload profile photo.');
          setIsSaving(false);
          return;
        }
        finalPhotoUrl = uploadResult.url;
      }

      await updateUser(user.id, {
        displayName: displayName.trim(),
        photoUrl: finalPhotoUrl,
      });

      // User data will be updated automatically via the real-time subscription
      Alert.alert('Success', 'Your profile has been updated.');
      router.back();
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update your profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['bottom']}
    >
      <LoadingOverlay visible={isSaving} message="Saving..." />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Photo */}
        <View style={styles.photoSection}>
          <Pressable onPress={handlePickImage} style={styles.avatarContainer}>
            <UserAvatar
              photoUrl={photoUrl}
              displayName={displayName || 'User'}
              size={120}
            />
            <View style={[styles.editBadge, { backgroundColor: theme.colors.primary }]}>
              <MaterialCommunityIcons name="camera" size={20} color="white" />
            </View>
          </Pressable>
          <Pressable onPress={handlePickImage}>
            <Text variant="bodyMedium" style={{ color: theme.colors.primary, marginTop: 12 }}>
              Change Photo
            </Text>
          </Pressable>
        </View>

        {/* Personal Details */}
        <Card style={styles.formCard}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Personal Details
          </Text>

          <TextInput
            label="Display Name"
            value={displayName}
            onChangeText={handleNameChange}
            mode="outlined"
            style={styles.input}
          />

          <TextInput
            label="Email"
            value={user?.email || ''}
            mode="outlined"
            disabled
            style={styles.input}
            right={<TextInput.Icon icon="lock" />}
          />
          <Text variant="bodySmall" style={[styles.helperText, { color: theme.colors.outline }]}>
            Email cannot be changed for security reasons.
          </Text>
        </Card>

        {/* Verification Status */}
        <Card style={styles.statusCard}>
          <View style={styles.statusRow}>
            <MaterialCommunityIcons
              name={user?.verificationStatus === 'verified' ? 'check-decagram' : 'clock-outline'}
              size={24}
              color={user?.verificationStatus === 'verified' ? theme.colors.primary : theme.colors.outline}
            />
            <View style={styles.statusText}>
              <Text variant="titleSmall">
                {user?.verificationStatus === 'verified' ? 'Verified Account' : 'Verification Pending'}
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                {user?.verificationStatus === 'verified'
                  ? 'Your identity has been verified'
                  : 'Complete identity verification to unlock all features'}
              </Text>
            </View>
          </View>
          {user?.verificationStatus !== 'verified' && (
            <PrimaryButton
              onPress={() => router.push('/(auth)/verify-identity')}
              style={styles.verifyButton}
              compact
            >
              Verify Now
            </PrimaryButton>
          )}
        </Card>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.buttonRow}>
          <SecondaryButton
            onPress={() => router.back()}
            style={styles.cancelButton}
          >
            Cancel
          </SecondaryButton>
          <PrimaryButton
            onPress={handleSave}
            disabled={!hasChanges || !displayName.trim()}
            loading={isSaving}
            style={styles.saveButton}
          >
            Save Changes
          </PrimaryButton>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarContainer: {
    position: 'relative',
  },
  editBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formCard: {
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 16,
  },
  input: {
    marginBottom: 12,
  },
  helperText: {
    marginTop: -8,
    marginLeft: 4,
  },
  statusCard: {
    padding: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  statusText: {
    flex: 1,
    marginLeft: 12,
  },
  verifyButton: {
    marginTop: 16,
  },
  footer: {
    padding: 24,
    paddingTop: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
  },
  saveButton: {
    flex: 1,
  },
});
