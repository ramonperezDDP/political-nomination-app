import React, { useState, useCallback } from 'react';
import { StyleSheet, View, Image, Pressable, Platform } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useRouter, useNavigation } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConfigStore, selectCurrentRoundLabel } from '@/stores';
import { useUserStore } from '@/stores';

const DISTRICT_COLORS: Record<string, string> = {
  'PA-01': '#FFB6C1',
  'PA-02': '#ADD8E6',
};

const AVAILABLE_DISTRICTS = ['PA-01', 'PA-02'];

const ROUND_IDS = [
  'round_1_endorsement',
  'round_2_endorsement',
  'round_3_endorsement',
  'virtual_town_hall',
  'debate',
  'final_results',
];

interface AppHeaderProps {
  hideDistrictPicker?: boolean;
  showBack?: boolean;
}

export default function AppHeader({ hideDistrictPicker, showBack }: AppHeaderProps = {}) {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const roundLabel = useConfigStore(selectCurrentRoundLabel);
  const debugRoundOverride = useConfigStore((s) => s.debugRoundOverride);
  const setDebugRound = useConfigStore((s) => s.setDebugRound);
  const contestRounds = useConfigStore((s) => s.contestRounds);
  const selectedDistrict = useUserStore((s) => s.selectedBrowsingDistrict) || 'PA-01';
  const setDistrict = useUserStore((s) => s.setSelectedBrowsingDistrict);
  const [menuVisible, setMenuVisible] = useState(false);

  const handleRoundTap = useCallback(() => {
    if (contestRounds.length === 0) return;
    const currentId = debugRoundOverride || useConfigStore.getState().partyConfig?.currentRoundId || 'round_1_endorsement';
    const currentIdx = ROUND_IDS.indexOf(currentId);
    const nextIdx = (currentIdx + 1) % ROUND_IDS.length;
    setDebugRound(ROUND_IDS[nextIdx]);
  }, [debugRoundOverride, contestRounds, setDebugRound]);

  const handleRoundLongPress = useCallback(() => {
    // Long press resets to Firestore value
    setDebugRound(null);
  }, [setDebugRound]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8, backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.outlineVariant }]}>
      {showBack ? (
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.onSurface} />
        </Pressable>
      ) : (
        <Image
          source={require('../../../assets/amsp-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      )}

      <Pressable
        style={styles.roundContainer}
        onPress={handleRoundTap}
        onLongPress={handleRoundLongPress}
      >
        <Text
          variant="labelSmall"
          style={{
            color: debugRoundOverride ? theme.colors.error : theme.colors.outline,
            fontWeight: debugRoundOverride ? '700' : undefined,
          }}
        >
          {roundLabel}
          {debugRoundOverride ? ' ⟳' : ''}
        </Text>
      </Pressable>

      {!hideDistrictPicker ? (
        <View>
          <Pressable
            onPress={() => setMenuVisible(!menuVisible)}
            style={[
              styles.districtButton,
              { backgroundColor: DISTRICT_COLORS[selectedDistrict] || '#E0E0E0' },
            ]}
          >
            <MaterialCommunityIcons name="map-marker" size={14} color="#333" />
            <Text variant="labelMedium" style={styles.districtText}>
              {selectedDistrict}
            </Text>
            <MaterialCommunityIcons name="chevron-down" size={14} color="#333" />
          </Pressable>
          {menuVisible && (
            <View style={[styles.dropdown, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
              {AVAILABLE_DISTRICTS.map((district) => (
                <Pressable
                  key={district}
                  onPress={() => {
                    setDistrict(district);
                    setMenuVisible(false);
                  }}
                  style={[styles.dropdownItem, selectedDistrict === district && { backgroundColor: theme.colors.secondaryContainer }]}
                >
                  {selectedDistrict === district && (
                    <MaterialCommunityIcons name="check" size={16} color={theme.colors.primary} />
                  )}
                  <Text variant="bodyMedium" style={{ marginLeft: selectedDistrict === district ? 4 : 20 }}>
                    {district}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      ) : <View style={{ width: 80 }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  logo: {
    width: 120,
    height: 36,
  },
  backButton: {
    width: 120,
    paddingVertical: 6,
  },
  roundContainer: {
    flex: 1,
    alignItems: 'center',
  },
  districtButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    gap: 4,
  },
  districtText: {
    fontWeight: '600',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 4,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 4,
    minWidth: 120,
    zIndex: 1000,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4 },
      android: { elevation: 4 },
      default: { boxShadow: '0 2px 8px rgba(0,0,0,0.15)' },
    }) as any,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
