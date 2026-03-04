import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Card } from '@/components/ui';

interface ContentCardProps {
  icon: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  completed?: boolean;
}

export default function ContentCard({
  icon,
  title,
  subtitle,
  onPress,
  completed,
}: ContentCardProps) {
  const theme = useTheme();

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
      <Card style={styles.card}>
        <View style={styles.content}>
          <View
            style={[
              styles.iconContainer,
              {
                backgroundColor: completed
                  ? theme.colors.primary
                  : theme.colors.surfaceVariant,
              },
            ]}
          >
            <MaterialCommunityIcons
              name={(completed ? 'check' : icon) as any}
              size={24}
              color={completed ? '#fff' : theme.colors.primary}
            />
          </View>
          <View style={styles.textContainer}>
            <Text variant="titleMedium" style={styles.title}>
              {title}
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
              {subtitle}
            </Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={24}
            color={theme.colors.outline}
          />
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontWeight: '600',
    marginBottom: 2,
  },
});
