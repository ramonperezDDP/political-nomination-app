import React, { useState } from 'react';
import { StyleSheet, View, Linking, Pressable } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Card } from '@/components/ui';

interface VideoCardProps {
  videoUrl?: string;
}

export default function VideoCard({ videoUrl }: VideoCardProps) {
  const theme = useTheme();

  const handlePress = () => {
    if (videoUrl) {
      Linking.openURL(videoUrl);
    }
  };

  return (
    <Pressable onPress={handlePress} disabled={!videoUrl}>
      <Card style={styles.card}>
        <View style={[styles.videoPlaceholder, { backgroundColor: theme.colors.surfaceVariant }]}>
          <MaterialCommunityIcons
            name="play-circle-outline"
            size={64}
            color={theme.colors.primary}
          />
          <Text variant="bodyMedium" style={{ color: theme.colors.outline, marginTop: 8 }}>
            {videoUrl ? 'Tap to watch' : 'Video coming soon'}
          </Text>
        </View>
        <View style={styles.info}>
          <Text variant="titleMedium" style={styles.title}>
            A Brand New Way
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
            Learn how our democratic nomination process works
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    overflow: 'hidden',
  },
  videoPlaceholder: {
    aspectRatio: 16 / 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    margin: 12,
    marginBottom: 0,
  },
  info: {
    padding: 16,
    paddingTop: 12,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
});
