import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Modal } from '@/components/ui';

interface EndorseLockModalProps {
  visible: boolean;
  reason: string | null;
  hasAccount: boolean;
  onDismiss: () => void;
  onSignUp: () => void;
  onVerify: () => void;
}

export default function EndorseLockModal({
  visible,
  reason,
  hasAccount,
  onDismiss,
  onSignUp,
  onVerify,
}: EndorseLockModalProps) {
  const theme = useTheme();

  if (!reason) return null;

  const isAccountIssue = reason.includes('Create an account');

  return (
    <Modal visible={visible} onDismiss={onDismiss} title="Endorsement Locked">
      <View style={styles.content}>
        <MaterialCommunityIcons
          name="lock-outline"
          size={48}
          color={theme.colors.outline}
          style={styles.icon}
        />
        <Text variant="bodyLarge" style={[styles.reason, { color: theme.colors.onSurface }]}>
          {reason}
        </Text>
        <View style={styles.actions}>
          {isAccountIssue ? (
            <Button mode="contained" onPress={onSignUp} style={styles.ctaButton}>
              Create Account
            </Button>
          ) : (
            <Button mode="contained" onPress={onVerify} style={styles.ctaButton}>
              Verify Identity
            </Button>
          )}
          <Button mode="text" onPress={onDismiss}>
            Maybe Later
          </Button>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  icon: {
    marginBottom: 16,
  },
  reason: {
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  actions: {
    width: '100%',
    gap: 8,
  },
  ctaButton: {
    marginHorizontal: 16,
  },
});
