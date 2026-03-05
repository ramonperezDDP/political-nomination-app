import React from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type ExperienceFilter = 'random' | 'issues' | 'most_important' | 'location';

const FILTER_LABELS: Record<ExperienceFilter, string> = {
  random: 'Explore',
  issues: 'My Issues',
  most_important: 'Top Picks',
  location: 'My Area',
};

interface ExperienceMenuProps {
  selectedFilter: ExperienceFilter;
  onFilterChange: (filter: ExperienceFilter) => void;
  style?: ViewStyle | ViewStyle[];
}

export default function ExperienceMenu({
  selectedFilter,
  onFilterChange,
  style,
}: ExperienceMenuProps) {
  // Stub: cycle through filters on tap — full dropdown in Plan 05
  const filters: ExperienceFilter[] = ['random', 'issues', 'most_important', 'location'];

  const handlePress = () => {
    const currentIndex = filters.indexOf(selectedFilter);
    const nextIndex = (currentIndex + 1) % filters.length;
    onFilterChange(filters[nextIndex]);
  };

  return (
    <Pressable
      onPress={handlePress}
      style={[styles.container, style]}
    >
      <Text style={styles.label}>{FILTER_LABELS[selectedFilter]}</Text>
      <MaterialCommunityIcons name="chevron-down" size={16} color="#fff" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 16,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  label: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
