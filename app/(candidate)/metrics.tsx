import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ScrollView, Dimensions, Platform } from 'react-native';
import { Text, useTheme, SegmentedButtons } from 'react-native-paper';
import { SafeAreaView as NativeSafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAuthStore, useCandidateStore } from '@/stores';
import { Card, LoadingScreen } from '@/components/ui';

const SafeAreaView = Platform.OS === 'web' ? View : NativeSafeAreaView;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type TimeRange = '7d' | '30d' | '90d';

export default function MetricsScreen() {
  const theme = useTheme();
  const { user } = useAuthStore();
  const { candidate, metrics, fetchCandidateByUser, fetchMetrics, isLoading } = useCandidateStore();

  const [timeRange, setTimeRange] = useState<TimeRange>('7d');

  useEffect(() => {
    if (user?.id) {
      fetchCandidateByUser(user.id);
    }
  }, [user?.id]);

  useEffect(() => {
    if (candidate?.id) {
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      fetchMetrics(candidate.id, days);
    }
  }, [candidate?.id, timeRange]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return '+100%';
    const change = ((current - previous) / previous) * 100;
    return change >= 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`;
  };

  // Calculate totals
  const totalViews = metrics.reduce((sum, m) => sum + m.profileViews, 0);
  const totalUniqueViewers = metrics.reduce((sum, m) => sum + m.uniqueViewers, 0);
  const totalEndorsements = metrics.reduce((sum, m) => sum + m.endorsementsReceived, 0);

  // Calculate week over week for the last period
  const midpoint = Math.floor(metrics.length / 2);
  const firstHalf = metrics.slice(0, midpoint);
  const secondHalf = metrics.slice(midpoint);
  const firstHalfViews = firstHalf.reduce((sum, m) => sum + m.profileViews, 0);
  const secondHalfViews = secondHalf.reduce((sum, m) => sum + m.profileViews, 0);

  if (isLoading && !candidate) {
    return <LoadingScreen message="Loading metrics..." />;
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['bottom']}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Time Range Selector */}
        <View style={styles.header}>
          <SegmentedButtons
            value={timeRange}
            onValueChange={(value) => setTimeRange(value as TimeRange)}
            buttons={[
              { value: '7d', label: '7 Days' },
              { value: '30d', label: '30 Days' },
              { value: '90d', label: '90 Days' },
            ]}
          />
        </View>

        {/* Overview Stats */}
        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <View style={styles.statContent}>
              <MaterialCommunityIcons
                name="eye"
                size={28}
                color={theme.colors.primary}
              />
              <Text variant="headlineMedium" style={styles.statValue}>
                {formatNumber(candidate?.profileViews || 0)}
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                Total Profile Views
              </Text>
              <Text
                variant="labelSmall"
                style={[
                  styles.changeText,
                  { color: secondHalfViews >= firstHalfViews ? '#4caf50' : '#f44336' },
                ]}
              >
                {calculateChange(secondHalfViews, firstHalfViews)} this period
              </Text>
            </View>
          </Card>

          <Card style={styles.statCard}>
            <View style={styles.statContent}>
              <MaterialCommunityIcons
                name="thumb-up"
                size={28}
                color={theme.colors.secondary}
              />
              <Text variant="headlineMedium" style={styles.statValue}>
                {formatNumber(candidate?.endorsementCount || 0)}
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                Total Endorsements
              </Text>
              <Text
                variant="labelSmall"
                style={[styles.changeText, { color: '#4caf50' }]}
              >
                +{totalEndorsements} this period
              </Text>
            </View>
          </Card>
        </View>

        {/* Chart Placeholder */}
        <Card style={styles.chartCard}>
          <Text variant="titleMedium" style={styles.chartTitle}>
            Profile Views Over Time
          </Text>
          <View style={[styles.chartPlaceholder, { backgroundColor: theme.colors.surfaceVariant }]}>
            <MaterialCommunityIcons
              name="chart-line"
              size={48}
              color={theme.colors.outline}
            />
            <Text variant="bodyMedium" style={{ color: theme.colors.outline, marginTop: 8 }}>
              Chart visualization
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
              (Requires chart library integration)
            </Text>
          </View>

          {/* Mini Stats */}
          <View style={styles.chartStats}>
            <View style={styles.chartStat}>
              <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>
                {formatNumber(totalViews)}
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                Views
              </Text>
            </View>
            <View style={styles.chartStat}>
              <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>
                {formatNumber(totalUniqueViewers)}
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                Unique Viewers
              </Text>
            </View>
            <View style={styles.chartStat}>
              <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>
                {metrics.length > 0
                  ? (totalViews / metrics.length).toFixed(1)
                  : '0'}
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                Avg/Day
              </Text>
            </View>
          </View>
        </Card>

        {/* PSA Performance */}
        <Card style={styles.sectionCard}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            PSA Performance
          </Text>
          <View style={styles.psaList}>
            {[1, 2, 3].map((_, index) => (
              <View key={index} style={styles.psaItem}>
                <View style={[styles.psaThumbnail, { backgroundColor: theme.colors.surfaceVariant }]}>
                  <MaterialCommunityIcons
                    name="video"
                    size={20}
                    color={theme.colors.outline}
                  />
                </View>
                <View style={styles.psaInfo}>
                  <Text variant="titleSmall">PSA {index + 1}</Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                    {formatNumber((3 - index) * 1200)} views
                  </Text>
                </View>
                <View style={styles.psaChart}>
                  <MaterialCommunityIcons
                    name="trending-up"
                    size={20}
                    color="#4caf50"
                  />
                </View>
              </View>
            ))}
          </View>
        </Card>

        {/* Endorsement Demographics */}
        <Card style={styles.sectionCard}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Endorsement Demographics
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.outline, marginBottom: 16 }}>
            Anonymous breakdown of your supporters
          </Text>

          <View style={styles.demographicSection}>
            <Text variant="titleSmall" style={styles.demographicTitle}>
              By Top Issue
            </Text>
            {['Healthcare', 'Economy', 'Climate'].map((issue, index) => (
              <View key={issue} style={styles.demographicBar}>
                <Text variant="bodySmall" style={styles.demographicLabel}>
                  {issue}
                </Text>
                <View style={styles.barContainer}>
                  <View
                    style={[
                      styles.bar,
                      {
                        backgroundColor: theme.colors.primary,
                        width: `${70 - index * 15}%`,
                      },
                    ]}
                  />
                </View>
                <Text variant="bodySmall" style={styles.demographicValue}>
                  {70 - index * 15}%
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.demographicSection}>
            <Text variant="titleSmall" style={styles.demographicTitle}>
              Geographic Distribution
            </Text>
            <View style={[styles.mapPlaceholder, { backgroundColor: theme.colors.surfaceVariant }]}>
              <MaterialCommunityIcons
                name="map"
                size={48}
                color={theme.colors.outline}
              />
              <Text variant="bodySmall" style={{ color: theme.colors.outline, marginTop: 8 }}>
                District heatmap
              </Text>
            </View>
          </View>
        </Card>
      </ScrollView>
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
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
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
  changeText: {
    marginTop: 4,
    fontWeight: '600',
  },
  chartCard: {
    margin: 16,
    padding: 16,
  },
  chartTitle: {
    fontWeight: 'bold',
    marginBottom: 16,
  },
  chartPlaceholder: {
    height: 200,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  chartStat: {
    alignItems: 'center',
  },
  sectionCard: {
    margin: 16,
    marginTop: 0,
    padding: 16,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: 16,
  },
  psaList: {
    gap: 12,
  },
  psaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  psaThumbnail: {
    width: 48,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  psaInfo: {
    flex: 1,
    marginLeft: 12,
  },
  psaChart: {
    width: 40,
    alignItems: 'center',
  },
  demographicSection: {
    marginBottom: 24,
  },
  demographicTitle: {
    fontWeight: '600',
    marginBottom: 12,
  },
  demographicBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  demographicLabel: {
    width: 80,
  },
  barContainer: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 4,
    marginHorizontal: 8,
  },
  bar: {
    height: '100%',
    borderRadius: 4,
  },
  demographicValue: {
    width: 40,
    textAlign: 'right',
  },
  mapPlaceholder: {
    height: 150,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
