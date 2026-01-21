import React, { useEffect } from 'react';
import { StyleSheet, View, FlatList } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Card, PrimaryButton, SecondaryButton, EmptyState } from '@/components/ui';
import { useAuthStore, useCandidateStore } from '@/stores';
import { subscribeToNotifications } from '@/services/firebase/firestore';
import type { Notification } from '@/types';

export default function CandidateHome() {
  const theme = useTheme();
  const { user } = useAuthStore();
  const { candidate, fetchCandidateByUser, metrics, fetchMetrics } = useCandidateStore();
  const [notifications, setNotifications] = React.useState<Notification[]>([]);

  useEffect(() => {
    if (user?.id) {
      fetchCandidateByUser(user.id);
    }
  }, [user?.id]);

  useEffect(() => {
    if (candidate?.id) {
      fetchMetrics(candidate.id, 7);
    }
  }, [candidate?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const unsubscribe = subscribeToNotifications(user.id, setNotifications);
    return unsubscribe;
  }, [user?.id]);

  // Calculate quick stats
  const todayViews = metrics.length > 0 ? metrics[metrics.length - 1]?.profileViews || 0 : 0;
  const totalViews = candidate?.profileViews || 0;
  const endorsements = candidate?.endorsementCount || 0;

  const filteredNotifications = searchQuery
    ? notifications.filter(
        (n) =>
          n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          n.body.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : notifications;

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'endorsement_received':
        return 'thumb-up';
      case 'message_received':
        return 'message';
      case 'application_approved':
        return 'check-circle';
      case 'application_denied':
        return 'close-circle';
      case 'new_psa':
        return 'video';
      case 'leaderboard_update':
        return 'trophy';
      default:
        return 'bell';
    }
  };

  const renderNotification = ({ item }: { item: Notification }) => (
    <Card
      style={!item.isRead
        ? [styles.notificationCard, { borderLeftWidth: 3, borderLeftColor: theme.colors.primary }]
        : styles.notificationCard}
    >
      <View style={styles.notificationContent}>
        <View
          style={[
            styles.notificationIcon,
            { backgroundColor: theme.colors.primaryContainer },
          ]}
        >
          <MaterialCommunityIcons
            name={getNotificationIcon(item.type)}
            size={20}
            color={theme.colors.primary}
          />
        </View>
        <View style={styles.notificationText}>
          <Text variant="titleSmall">{item.title}</Text>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.outline }}
            numberOfLines={2}
          >
            {item.body}
          </Text>
          <Text
            variant="labelSmall"
            style={{ color: theme.colors.outline, marginTop: 4 }}
          >
            {item.createdAt?.toDate?.().toLocaleDateString() || 'Just now'}
          </Text>
        </View>
      </View>
    </Card>
  );

  return (
    <View style={styles.container}>
      {/* Quick Stats */}
      <View style={styles.statsGrid}>
        <Card style={styles.statCard}>
          <View style={styles.statContent}>
            <MaterialCommunityIcons
              name="eye"
              size={24}
              color={theme.colors.primary}
            />
            <Text variant="headlineSmall" style={styles.statValue}>
              {todayViews}
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
              Views Today
            </Text>
          </View>
        </Card>

        <Card style={styles.statCard}>
          <View style={styles.statContent}>
            <MaterialCommunityIcons
              name="chart-line"
              size={24}
              color={theme.colors.secondary}
            />
            <Text variant="headlineSmall" style={styles.statValue}>
              {totalViews}
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
              Total Views
            </Text>
          </View>
        </Card>

        <Card style={styles.statCard}>
          <View style={styles.statContent}>
            <MaterialCommunityIcons
              name="thumb-up"
              size={24}
              color={theme.colors.tertiary}
            />
            <Text variant="headlineSmall" style={styles.statValue}>
              {endorsements}
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
              Endorsements
            </Text>
          </View>
        </Card>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <PrimaryButton
          onPress={() => router.push('/(candidate)/creation')}
          icon="account-edit"
          style={styles.actionButton}
        >
          Edit Profile
        </PrimaryButton>
        <SecondaryButton
          onPress={() => router.push('/(candidate)/metrics')}
          icon="chart-bar"
          style={styles.actionButton}
        >
          View Metrics
        </SecondaryButton>
      </View>

      {/* Notification Feed */}
      <View style={styles.feedHeader}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Notifications
        </Text>
        <Text
          variant="bodySmall"
          style={{ color: theme.colors.primary }}
          onPress={() => router.push('/(candidate)/messages')}
        >
          View All
        </Text>
      </View>

      {filteredNotifications.length === 0 ? (
        <EmptyState
          icon="bell-outline"
          title="No notifications yet"
          message="You'll see endorsements, messages, and updates here"
          style={styles.emptyState}
        />
      ) : (
        <FlatList
          data={filteredNotifications.slice(0, 10)}
          renderItem={renderNotification}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {/* Campaign Tips */}
      <Card style={[styles.tipsCard, { backgroundColor: theme.colors.secondaryContainer }]}>
        <View style={styles.tipsContent}>
          <MaterialCommunityIcons
            name="lightbulb-outline"
            size={32}
            color={theme.colors.secondary}
          />
          <View style={styles.tipsText}>
            <Text variant="titleSmall" style={{ color: theme.colors.onSecondaryContainer }}>
              Campaign Tip
            </Text>
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSecondaryContainer, opacity: 0.8 }}
            >
              Upload regular PSA videos to engage with voters and increase your visibility in the feed.
            </Text>
          </View>
        </View>
        <SecondaryButton
          onPress={() => router.push('/(candidate)/creation')}
          style={styles.tipsButton}
        >
          Create PSA
        </SecondaryButton>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
  },
  statContent: {
    alignItems: 'center',
    padding: 8,
  },
  statValue: {
    fontWeight: 'bold',
    marginTop: 8,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
  },
  feedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontWeight: 'bold',
  },
  notificationCard: {
    marginBottom: 0,
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationText: {
    flex: 1,
    marginLeft: 12,
  },
  separator: {
    height: 8,
  },
  emptyState: {
    paddingVertical: 40,
  },
  tipsCard: {
    marginTop: 24,
    padding: 16,
  },
  tipsContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  tipsText: {
    flex: 1,
    marginLeft: 12,
  },
  tipsButton: {},
});
