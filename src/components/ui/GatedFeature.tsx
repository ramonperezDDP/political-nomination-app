import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface GatedFeatureProps {
  /** Is the feature unlocked? */
  isUnlocked: boolean;
  /** What the user sees when unlocked (the actual feature) */
  children: React.ReactNode;
  /** Short label for what's locked (e.g., "Alignment Score") */
  featureLabel: string;
  /** What the user needs to do (e.g., "Complete your quiz") */
  unlockPrompt: string;
  /** Where tapping the locked state navigates to */
  unlockRoute?: string;
  /** Inline mode: renders small lock badge instead of full overlay */
  inline?: boolean;
}

export default function GatedFeature({
  isUnlocked,
  children,
  featureLabel,
  unlockPrompt,
  unlockRoute,
  inline = false,
}: GatedFeatureProps) {
  const theme = useTheme();
  const router = useRouter();

  if (isUnlocked) return <>{children}</>;

  const handlePress = () => {
    if (unlockRoute) router.push(unlockRoute as any);
  };

  if (inline) {
    return (
      <Pressable onPress={handlePress} style={styles.inlineLock}>
        <MaterialCommunityIcons name="lock" size={16} color={theme.colors.outline} />
        <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
          {unlockPrompt}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={handlePress} style={styles.lockedOverlay}>
      <MaterialCommunityIcons name="lock-outline" size={24} color={theme.colors.outline} />
      <Text variant="bodySmall" style={styles.lockedLabel}>{featureLabel}</Text>
      <Text variant="labelSmall" style={styles.unlockText}>{unlockPrompt}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  inlineLock: { flexDirection: 'row', alignItems: 'center', gap: 4, opacity: 0.6 },
  lockedOverlay: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.04)',
    gap: 4,
  },
  lockedLabel: { fontWeight: '600' },
  unlockText: { color: '#666', textAlign: 'center' },
});
