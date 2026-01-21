import React from 'react';
import { StyleSheet, View, ViewStyle, DimensionValue } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';

interface LoadingSpinnerProps {
  size?: 'small' | 'large' | number;
  color?: string;
  style?: ViewStyle;
}

export function LoadingSpinner({ size = 'large', color, style }: LoadingSpinnerProps) {
  const theme = useTheme();

  return (
    <ActivityIndicator
      size={size}
      color={color || theme.colors.primary}
      style={style}
    />
  );
}

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
}

export function LoadingOverlay({ visible, message }: LoadingOverlayProps) {
  const theme = useTheme();

  if (!visible) return null;

  return (
    <View style={[styles.overlay, { backgroundColor: 'rgba(0, 0, 0, 0.7)' }]}>
      <View style={[styles.loadingBox, { backgroundColor: theme.colors.surface }]}>
        <LoadingSpinner />
        {message && (
          <Text style={styles.loadingText} variant="bodyMedium">
            {message}
          </Text>
        )}
      </View>
    </View>
  );
}

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = 'Loading...' }: LoadingScreenProps) {
  const theme = useTheme();

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <LoadingSpinner />
      <Text style={styles.screenText} variant="bodyLarge">
        {message}
      </Text>
    </View>
  );
}

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
}: SkeletonProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          backgroundColor: theme.colors.surfaceVariant,
        },
        style,
      ]}
    />
  );
}

export function SkeletonCard() {
  return (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonCardHeader}>
        <Skeleton width={48} height={48} borderRadius={24} />
        <View style={styles.skeletonCardHeaderText}>
          <Skeleton width={120} height={16} />
          <Skeleton width={80} height={12} style={{ marginTop: 8 }} />
        </View>
      </View>
      <Skeleton height={100} style={{ marginTop: 12 }} />
      <View style={styles.skeletonCardFooter}>
        <Skeleton width={60} height={24} borderRadius={12} />
        <Skeleton width={60} height={24} borderRadius={12} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingBox: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 150,
  },
  loadingText: {
    marginTop: 16,
  },
  screen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  screenText: {
    marginTop: 16,
  },
  skeleton: {
    opacity: 0.5,
  },
  skeletonCard: {
    padding: 16,
    marginBottom: 12,
  },
  skeletonCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  skeletonCardHeaderText: {
    marginLeft: 12,
    flex: 1,
  },
  skeletonCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
});
