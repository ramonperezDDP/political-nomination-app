import React from 'react';
import { StyleSheet, View, ScrollView, Pressable, Linking, Alert } from 'react-native';
import { Text, useTheme, Divider, List } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import {
  useAuthStore,
  useUserStore,
  selectIsCandidate,
  selectHasPendingApplication,
  useCandidateStore,
} from '@/stores';
import { Card, UserAvatar, Chip, ConfirmModal } from '@/components/ui';

export default function ProfileScreen() {
  const theme = useTheme();
  const { user, signOut } = useAuthStore();
  const { userProfile, endorsements } = useUserStore();
  const isCandidate = useAuthStore(selectIsCandidate);
  const { application } = useCandidateStore();
  const hasPendingApplication = application?.status === 'pending' || application?.status === 'under_review';

  const [showSignOutModal, setShowSignOutModal] = React.useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  const openUrl = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Cannot open this link');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open link');
    }
  };

  const handleContactSupport = () => {
    Linking.openURL('mailto:support@politicalnomination.app?subject=Support%20Request');
  };

  const handleSendFeedback = () => {
    Linking.openURL('mailto:feedback@politicalnomination.app?subject=App%20Feedback');
  };

  const menuSections = [
    {
      title: 'Account',
      items: [
        {
          id: 'personal-info',
          icon: 'account-edit',
          label: 'Personal Information',
          description: 'Update your name and contact details',
          onPress: () => router.push('/settings/personal-info'),
        },
        {
          id: 'policy-preferences',
          icon: 'tune',
          label: 'Policy Preferences',
          description: 'Update your issues and questionnaire answers',
          onPress: () => router.push('/settings/issues'),
        },
        {
          id: 'dealbreakers',
          icon: 'alert-circle',
          label: 'Dealbreakers',
          description: 'Manage your dealbreaker positions',
          onPress: () => router.push('/settings/dealbreakers'),
        },
      ],
    },
    {
      title: 'Activity',
      items: [
        {
          id: 'endorsements',
          icon: 'thumb-up',
          label: 'My Endorsements',
          description: `${endorsements.length} candidate${endorsements.length !== 1 ? 's' : ''} endorsed`,
          onPress: () => router.push('/settings/endorsements'),
        },
        {
          id: 'for-you',
          icon: 'card-account-details',
          label: 'Browse Candidates',
          description: 'Discover candidates that match your values',
          onPress: () => router.push('/(tabs)/for-you'),
        },
      ],
    },
    ...(isCandidate
      ? [
          {
            title: 'Candidate Tools',
            items: [
              {
                id: 'profile-editor',
                icon: 'account-tie',
                label: 'Edit Campaign Profile',
                description: 'Update your candidate profile',
                onPress: () => router.push('/(candidate)/creation'),
              },
              {
                id: 'metrics',
                icon: 'chart-bar',
                label: 'Campaign Metrics',
                description: 'View your performance analytics',
                onPress: () => router.push('/(candidate)/metrics'),
              },
              {
                id: 'messages',
                icon: 'message',
                label: 'Messages',
                description: 'Communicate with your team',
                onPress: () => router.push('/(candidate)/messages'),
              },
            ],
          },
        ]
      : []),
    {
      title: 'Support',
      items: [
        {
          id: 'help',
          icon: 'help-circle',
          label: 'Help Center',
          description: 'FAQs and support articles',
          onPress: () => openUrl('https://politicalnomination.app/help'),
        },
        {
          id: 'contact',
          icon: 'email',
          label: 'Contact Support',
          description: 'Get help from our team',
          onPress: handleContactSupport,
        },
        {
          id: 'feedback',
          icon: 'message-alert',
          label: 'Send Feedback',
          description: 'Help us improve the app',
          onPress: handleSendFeedback,
        },
      ],
    },
    {
      title: 'Legal',
      items: [
        {
          id: 'terms',
          icon: 'file-document',
          label: 'Terms of Service',
          description: undefined,
          onPress: () => openUrl('https://politicalnomination.app/terms'),
        },
        {
          id: 'privacy',
          icon: 'shield-lock',
          label: 'Privacy Policy',
          description: undefined,
          onPress: () => openUrl('https://politicalnomination.app/privacy'),
        },
      ],
    },
  ];

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top']}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.header}>
          <UserAvatar
            photoUrl={user?.photoUrl || undefined}
            displayName={user?.displayName || 'User'}
            size={80}
          />
          <View style={styles.headerInfo}>
            <Text variant="headlineSmall" style={styles.displayName}>
              {user?.displayName || 'User'}
            </Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.outline }}>
              {user?.email}
            </Text>
            <View style={styles.roleBadge}>
              <Chip
                label={isCandidate ? 'Candidate' : 'Voter'}
                variant={isCandidate ? 'success' : 'info'}
              />
              {userProfile?.verificationStatus === 'verified' && (
                <MaterialCommunityIcons
                  name="check-decagram"
                  size={20}
                  color={theme.colors.primary}
                  style={{ marginLeft: 8 }}
                />
              )}
            </View>
          </View>
        </View>

        {/* Run for Office CTA (for non-candidates) */}
        {!isCandidate && !hasPendingApplication && (
          <Card
            style={[styles.ctaCard, { backgroundColor: theme.colors.primaryContainer }]}
            onPress={() => router.push('/(candidate)/apply')}
          >
            <View style={styles.ctaContent}>
              <MaterialCommunityIcons
                name="podium"
                size={40}
                color={theme.colors.primary}
              />
              <View style={styles.ctaText}>
                <Text
                  variant="titleMedium"
                  style={{ color: theme.colors.onPrimaryContainer }}
                >
                  Run for Office
                </Text>
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.onPrimaryContainer, opacity: 0.8 }}
                >
                  Start your campaign and connect with voters
                </Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={24}
                color={theme.colors.primary}
              />
            </View>
          </Card>
        )}

        {/* Pending Application Banner */}
        {hasPendingApplication && (
          <Card
            style={[styles.pendingCard, { backgroundColor: theme.colors.secondaryContainer }]}
          >
            <View style={styles.pendingContent}>
              <MaterialCommunityIcons
                name="clock-outline"
                size={24}
                color={theme.colors.secondary}
              />
              <View style={styles.pendingText}>
                <Text
                  variant="titleSmall"
                  style={{ color: theme.colors.onSecondaryContainer }}
                >
                  Application Under Review
                </Text>
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.onSecondaryContainer, opacity: 0.8 }}
                >
                  We'll notify you once your application is processed
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* Menu Sections */}
        {menuSections.map((section, sectionIndex) => (
          <View key={section.title} style={styles.menuSection}>
            <Text variant="titleSmall" style={styles.sectionTitle}>
              {section.title}
            </Text>
            <Card style={styles.menuCard}>
              {section.items.map((item, itemIndex) => (
                <React.Fragment key={item.id}>
                  <List.Item
                    title={item.label}
                    description={item.description}
                    left={(props) => (
                      <List.Icon {...props} icon={item.icon} />
                    )}
                    right={(props) => (
                      <List.Icon {...props} icon="chevron-right" />
                    )}
                    onPress={item.onPress}
                    style={styles.menuItem}
                  />
                  {itemIndex < section.items.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </Card>
          </View>
        ))}

        {/* Sign Out */}
        <Pressable
          onPress={() => setShowSignOutModal(true)}
          style={({ pressed }) => [
            styles.signOutButton,
            { opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <MaterialCommunityIcons
            name="logout"
            size={20}
            color={theme.colors.error}
          />
          <Text
            variant="titleMedium"
            style={[styles.signOutText, { color: theme.colors.error }]}
          >
            Sign Out
          </Text>
        </Pressable>

        {/* App Version */}
        <Text
          variant="bodySmall"
          style={[styles.versionText, { color: theme.colors.outline }]}
        >
          Version 1.0.0
        </Text>
      </ScrollView>

      {/* Sign Out Confirmation Modal */}
      <ConfirmModal
        visible={showSignOutModal}
        onDismiss={() => setShowSignOutModal(false)}
        onConfirm={handleSignOut}
        title="Sign Out"
        message="Are you sure you want to sign out?"
        confirmLabel="Sign Out"
        cancelLabel="Cancel"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
    paddingBottom: 16,
  },
  headerInfo: {
    marginLeft: 16,
    flex: 1,
  },
  displayName: {
    fontWeight: 'bold',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  ctaCard: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  ctaContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  ctaText: {
    flex: 1,
    marginLeft: 16,
  },
  pendingCard: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  pendingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  pendingText: {
    flex: 1,
    marginLeft: 12,
  },
  menuSection: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 4,
  },
  menuCard: {
    overflow: 'hidden',
  },
  menuItem: {
    paddingVertical: 4,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  signOutText: {
    marginLeft: 8,
    fontWeight: '600',
  },
  versionText: {
    textAlign: 'center',
    marginBottom: 32,
  },
});
