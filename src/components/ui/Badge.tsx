import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { Badge as PaperBadge, Text, useTheme } from 'react-native-paper';

interface BadgeProps {
  children?: React.ReactNode;
  visible?: boolean;
  size?: number;
  style?: ViewStyle;
}

export function Badge({ children, visible = true, size = 20, style }: BadgeProps) {
  return (
    <PaperBadge visible={visible} size={size} style={style}>
      {children as string | number}
    </PaperBadge>
  );
}

interface BadgeWithIconProps {
  icon: React.ReactNode;
  count?: number;
  maxCount?: number;
  style?: ViewStyle;
}

export function BadgeWithIcon({
  icon,
  count,
  maxCount = 99,
  style,
}: BadgeWithIconProps) {
  const displayCount = count && count > maxCount ? `${maxCount}+` : count;

  return (
    <View style={StyleSheet.flatten([styles.badgeContainer, style])}>
      {icon}
      {count !== undefined && count > 0 && (
        <Badge style={styles.iconBadge}>{displayCount}</Badge>
      )}
    </View>
  );
}

type ChipVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

interface ChipProps {
  label: string;
  variant?: ChipVariant;
  icon?: string;
  onClose?: () => void;
  style?: ViewStyle;
}

export function Chip({
  label,
  variant = 'default',
  icon,
  onClose,
  style,
}: ChipProps) {
  const theme = useTheme();

  const getVariantColors = () => {
    switch (variant) {
      case 'success':
        return { bg: '#4caf50', text: '#ffffff' };
      case 'warning':
        return { bg: '#ff9800', text: '#000000' };
      case 'error':
        return { bg: '#f44336', text: '#ffffff' };
      case 'info':
        return { bg: '#2196f3', text: '#ffffff' };
      default:
        return { bg: theme.colors.surfaceVariant, text: theme.colors.onSurfaceVariant };
    }
  };

  const colors = getVariantColors();

  return (
    <View style={StyleSheet.flatten([styles.chip, { backgroundColor: colors.bg }, style])}>
      <Text style={StyleSheet.flatten([styles.chipText, { color: colors.text }])}>{label}</Text>
    </View>
  );
}

interface AlignmentBadgeProps {
  score: number;
  size?: 'small' | 'medium' | 'large';
  style?: ViewStyle;
}

export function AlignmentBadge({ score, size = 'medium', style }: AlignmentBadgeProps) {
  const getColor = () => {
    if (score >= 80) return '#4caf50';
    if (score >= 60) return '#8bc34a';
    if (score >= 40) return '#ff9800';
    if (score >= 20) return '#ff5722';
    return '#f44336';
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return { width: 36, height: 36, fontSize: 12 };
      case 'large':
        return { width: 64, height: 64, fontSize: 20 };
      default:
        return { width: 48, height: 48, fontSize: 16 };
    }
  };

  const sizeStyles = getSizeStyles();

  return (
    <View
      style={StyleSheet.flatten([
        styles.alignmentBadge,
        {
          backgroundColor: getColor(),
          width: sizeStyles.width,
          height: sizeStyles.height,
        },
        style,
      ])}
    >
      <Text style={StyleSheet.flatten([styles.alignmentText, { fontSize: sizeStyles.fontSize }])}>
        {Math.round(score)}%
      </Text>
    </View>
  );
}

interface RankBadgeProps {
  rank: number;
  style?: ViewStyle;
}

export function RankBadge({ rank, style }: RankBadgeProps) {
  const theme = useTheme();

  const getMedalColor = () => {
    switch (rank) {
      case 1:
        return '#FFD700';
      case 2:
        return '#C0C0C0';
      case 3:
        return '#CD7F32';
      default:
        return theme.colors.surfaceVariant;
    }
  };

  return (
    <View
      style={StyleSheet.flatten([
        styles.rankBadge,
        { backgroundColor: getMedalColor() },
        style,
      ])}
    >
      <Text style={styles.rankText}>#{rank}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badgeContainer: {
    position: 'relative',
  },
  iconBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  alignmentBadge: {
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alignmentText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
  },
});
