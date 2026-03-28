import React, { useState } from 'react';
import { View, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useUserStore, selectCanSeeAlignment } from '@/stores';

export type ExperienceFilter = 'location' | 'issues';

interface ExperienceMenuProps {
  selectedFilter: ExperienceFilter;
  onFilterChange: (filter: ExperienceFilter) => void;
  onLocationPress?: () => void;
  style?: ViewStyle | ViewStyle[];
}

interface FilterOption {
  id: ExperienceFilter;
  label: string;
  icon: string;
  disabledDescription: string;
}

const FILTER_OPTIONS: FilterOption[] = [
  { id: 'issues', label: 'My Issues', icon: 'clipboard-list', disabledDescription: 'Complete the quiz to unlock' },
  { id: 'location', label: 'My Area', icon: 'map-marker', disabledDescription: '' },
];

export default function ExperienceMenu({
  selectedFilter,
  onFilterChange,
  onLocationPress,
  style,
}: ExperienceMenuProps) {
  const [open, setOpen] = useState(false);

  const canSeeAlignment = useUserStore(selectCanSeeAlignment);

  const selectedOption = FILTER_OPTIONS.find((o) => o.id === selectedFilter);

  const isFilterDisabled = (filterId: ExperienceFilter): boolean => {
    switch (filterId) {
      case 'issues':
        return !canSeeAlignment;
      default:
        return false;
    }
  };

  const handleSelect = (filter: ExperienceFilter) => {
    if (isFilterDisabled(filter)) return;
    if (filter === 'location' && onLocationPress) {
      onLocationPress();
    }
    onFilterChange(filter);
    setOpen(false);
  };

  return (
    <View style={[styles.container, style]}>
      {/* Anchor button */}
      <Pressable onPress={() => setOpen((o) => !o)} style={styles.anchor}>
        <MaterialCommunityIcons
          name={(selectedOption?.icon as any) || 'filter'}
          size={16}
          color="#fff"
        />
        <Text style={styles.anchorLabel}>{selectedOption?.label}</Text>
        <MaterialCommunityIcons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={16}
          color="#fff"
        />
      </Pressable>

      {/* Dropdown */}
      {open && (
        <>
          {/* Dismiss backdrop (within this view, not Portal) */}
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={styles.dropdown}>
            {FILTER_OPTIONS.map((option) => {
              const disabled = isFilterDisabled(option.id);
              const isSelected = selectedFilter === option.id;

              return (
                <Pressable
                  key={option.id}
                  onPress={() => handleSelect(option.id)}
                  disabled={disabled}
                  style={[styles.option, isSelected && styles.optionSelected]}
                >
                  <MaterialCommunityIcons
                    name={(disabled ? 'lock' : option.icon) as any}
                    size={18}
                    color={disabled ? 'rgba(0,0,0,0.3)' : isSelected ? '#5a3977' : '#333'}
                  />
                  <View style={styles.optionTextContainer}>
                    <Text
                      style={[
                        styles.optionLabel,
                        disabled && styles.optionDisabled,
                        isSelected && styles.optionLabelSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                    {disabled && option.disabledDescription ? (
                      <Text style={styles.optionHint}>{option.disabledDescription}</Text>
                    ) : null}
                  </View>
                  {isSelected && (
                    <MaterialCommunityIcons name="check" size={18} color="#5a3977" />
                  )}
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 16,
    zIndex: 100,
  },
  anchor: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  anchorLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  backdrop: {
    position: 'absolute',
    top: -200,
    left: -300,
    right: -50,
    bottom: -800,
    zIndex: 1,
  },
  dropdown: {
    position: 'absolute',
    top: 40,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 4,
    minWidth: 220,
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  optionSelected: {
    backgroundColor: 'rgba(90,57,119,0.08)',
  },
  optionTextContainer: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 14,
    color: '#333',
  },
  optionLabelSelected: {
    color: '#5a3977',
    fontWeight: '600',
  },
  optionDisabled: {
    color: 'rgba(0,0,0,0.3)',
  },
  optionHint: {
    fontSize: 11,
    color: 'rgba(0,0,0,0.4)',
    marginTop: 2,
  },
});
