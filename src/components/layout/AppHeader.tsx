import React, { useState, useCallback } from 'react';
import { StyleSheet, View, Image, Pressable } from 'react-native';
import { Text, useTheme, Menu } from 'react-native-paper';
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
  'pre_nomination',
  'round_1_endorsement',
  'round_2_endorsement',
  'round_3_endorsement',
  'virtual_town_hall',
  'debate',
  'final_results',
];

interface AppHeaderProps {
  hideDistrictPicker?: boolean;
}

export default function AppHeader({ hideDistrictPicker }: AppHeaderProps = {}) {
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
    const currentId = debugRoundOverride || useConfigStore.getState().partyConfig?.currentRoundId || 'pre_nomination';
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
      <Image
        source={require('../../../assets/amsp-logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />

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
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <Pressable
              onPress={() => setMenuVisible(true)}
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
          }
        >
          {AVAILABLE_DISTRICTS.map((district) => (
            <Menu.Item
              key={district}
              onPress={() => {
                setDistrict(district);
                setMenuVisible(false);
              }}
              title={district}
              leadingIcon={selectedDistrict === district ? 'check' : undefined}
            />
          ))}
        </Menu>
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
});
