import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Pressable, Modal, ScrollView, Animated, Platform, Linking } from 'react-native';
import { Text, Button, Portal, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Card } from '@/components/ui';
import { useAuthStore } from '@/stores';
import { updateUser } from '@/services/firebase/firestore';

interface VerifyIdentitySheetProps {
  visible: boolean;
  onDismiss: () => void;
}

export default function VerifyIdentitySheet({ visible, onDismiss }: VerifyIdentitySheetProps) {
  const theme = useTheme();
  const slideAnim = useRef(new Animated.Value(400)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(backdropAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, damping: 20, stiffness: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 400, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const handleAccept = async () => {
    if (!user?.id) return;

    const verifiedData = {
      isAnonymous: false,
      verification: {
        email: 'verified' as const,
        voterRegistration: 'verified' as const,
        photoId: 'verified' as const,
      },
      districts: [
        { id: 'PA-01', name: 'Pennsylvania 1st' },
        { id: 'PA-02', name: 'Pennsylvania 2nd' },
      ],
    };

    try {
      await updateUser(user.id, verifiedData);
      // Update local state so UI reflects immediately
      setUser({ ...user, ...verifiedData });
    } catch (err) {
      console.error('Failed to update verification:', err);
    }

    onDismiss();
  };

  const isWeb = Platform.OS === 'web';

  const [webMounted, setWebMounted] = useState(false);
  const [webAnimating, setWebAnimating] = useState(false);
  useEffect(() => {
    if (!isWeb) return;
    if (visible) {
      setWebMounted(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setWebAnimating(true)));
    } else {
      setWebAnimating(false);
      const timer = setTimeout(() => setWebMounted(false), 300);
      return () => clearTimeout(timer);
    }
  }, [visible, isWeb]);

  const sheetStyle = isWeb
    ? [styles.sheet, {
        backgroundColor: theme.colors.surface,
        transform: [{ translateY: webAnimating ? 0 : 400 }],
        transition: 'transform 0.3s ease-out',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
      } as any]
    : [styles.sheet, { backgroundColor: theme.colors.surface, transform: [{ translateY: slideAnim }] }];

  const sheetContent = (
    <View style={isWeb ? styles.webBackdrop : styles.backdrop}>
      {isWeb ? (
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
      ) : (
        <Animated.View style={[styles.backdropOverlay, { opacity: backdropAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
        </Animated.View>
      )}
      <Animated.View style={sheetStyle}
      >
        <View style={[styles.handle, { backgroundColor: theme.colors.outlineVariant }]} />

        <View style={styles.iconRow}>
          <MaterialCommunityIcons name="shield-check" size={48} color={theme.colors.primary} />
        </View>
        <Text variant="titleMedium" style={styles.sheetTitle}>
          Verify Identity
        </Text>

        <ScrollView style={styles.scrollContent} bounces={false}>
          <Text variant="bodyMedium" style={[styles.bodyText, { color: theme.colors.onSurfaceVariant }]}>
            In this demo, all users can access nominating contests in both districts without pre-verification. In a live contest, identity verification is mandatory — your device must be linked to a U.S. citizen of voting age residing in the district, and you must verify your identity via facial recognition before endorsing.
          </Text>
          <View style={styles.infoCards}>
            <Card style={styles.infoCard}>
              <View style={styles.infoCardContent}>
                <MaterialCommunityIcons name="card-account-details" size={24} color={theme.colors.primary} />
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
                <MaterialCommunityIcons name="camera-account" size={24} color={theme.colors.primary} />
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
                <MaterialCommunityIcons name="lock" size={24} color={theme.colors.primary} />
                <View style={styles.infoCardText}>
                  <Text variant="titleSmall">Secure & Private</Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                    Your data is encrypted and protected
                  </Text>
                </View>
              </View>
            </Card>
          </View>

          <Text variant="bodyMedium" style={[styles.bodyText, { color: theme.colors.onSurfaceVariant }]}>
            Identity verification requires additional funding. Please consider a{' '}
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.primary, textDecorationLine: 'underline' }}
              onPress={() => Linking.openURL('https://www.mainstreetparty.org/donate')}
            >
              donation
            </Text>
            .
          </Text>
        </ScrollView>

        <Button
          mode="contained"
          onPress={handleAccept}
          style={styles.button}
          labelStyle={styles.buttonLabel}
        >
          I understand
        </Button>
      </Animated.View>
    </View>
  );

  if (isWeb) {
    if (!webMounted) return null;
    return <Portal>{sheetContent}</Portal>;
  }

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent={true}
      onRequestClose={onDismiss}
    >
      {sheetContent}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  webBackdrop: {
    position: 'absolute' as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    zIndex: 9999,
  },
  backdropOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 12,
    maxHeight: '90%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  iconRow: {
    alignItems: 'center',
    marginBottom: 8,
  },
  sheetTitle: {
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  scrollContent: {
    flexGrow: 0,
    marginBottom: 20,
  },
  bodyText: {
    lineHeight: 22,
    marginBottom: 12,
  },
  infoCards: {
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  infoCard: {
    marginBottom: 8,
  },
  infoCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoCardText: {
    marginLeft: 16,
    flex: 1,
  },
  button: {
    borderRadius: 24,
  },
  buttonLabel: {
    fontWeight: '600',
    paddingVertical: 4,
  },
});
