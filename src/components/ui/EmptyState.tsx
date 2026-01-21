import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { PrimaryButton, SecondaryButton } from './Button';

interface EmptyStateProps {
  icon?: string;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  style?: ViewStyle;
}

export function EmptyState({
  icon = 'inbox-outline',
  title,
  message,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  style,
}: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, style]}>
      <MaterialCommunityIcons
        name={icon as any}
        size={80}
        color={theme.colors.outline}
        style={styles.icon}
      />
      <Text variant="titleLarge" style={styles.title}>
        {title}
      </Text>
      {message && (
        <Text
          variant="bodyMedium"
          style={[styles.message, { color: theme.colors.outline }]}
        >
          {message}
        </Text>
      )}
      {actionLabel && onAction && (
        <PrimaryButton onPress={onAction} style={styles.button}>
          {actionLabel}
        </PrimaryButton>
      )}
      {secondaryActionLabel && onSecondaryAction && (
        <SecondaryButton onPress={onSecondaryAction} style={styles.secondaryButton}>
          {secondaryActionLabel}
        </SecondaryButton>
      )}
    </View>
  );
}

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  style?: ViewStyle;
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'An error occurred. Please try again.',
  onRetry,
  style,
}: ErrorStateProps) {
  return (
    <EmptyState
      icon="alert-circle-outline"
      title={title}
      message={message}
      actionLabel={onRetry ? 'Try Again' : undefined}
      onAction={onRetry}
      style={style}
    />
  );
}

interface NoResultsProps {
  searchTerm?: string;
  onClear?: () => void;
  style?: ViewStyle;
}

export function NoResults({ searchTerm, onClear, style }: NoResultsProps) {
  return (
    <EmptyState
      icon="magnify"
      title="No results found"
      message={
        searchTerm
          ? `No results found for "${searchTerm}". Try different keywords.`
          : 'No items match your search criteria.'
      }
      actionLabel={onClear ? 'Clear Search' : undefined}
      onAction={onClear}
      style={style}
    />
  );
}

interface OfflineStateProps {
  onRetry?: () => void;
  style?: ViewStyle;
}

export function OfflineState({ onRetry, style }: OfflineStateProps) {
  return (
    <EmptyState
      icon="wifi-off"
      title="You're offline"
      message="Please check your internet connection and try again."
      actionLabel="Retry"
      onAction={onRetry}
      style={style}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  icon: {
    marginBottom: 16,
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    textAlign: 'center',
    maxWidth: 300,
    marginBottom: 24,
  },
  button: {
    minWidth: 150,
  },
  secondaryButton: {
    marginTop: 12,
    minWidth: 150,
  },
});
