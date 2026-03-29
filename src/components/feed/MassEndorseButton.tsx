import React, { useState, useMemo } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Button } from 'react-native-paper';
import { useAuthStore, useConfigStore, selectCurrentRoundId } from '@/stores';
import { useUserStore, selectFullyVerified, selectHasAccount } from '@/stores';
import { ConfirmModal } from '@/components/ui/Modal';
import type { FeedItem } from '@/types';

interface MassEndorseButtonProps {
  filteredItems: FeedItem[];
  experienceFilter: string;
  style?: ViewStyle | ViewStyle[];
}

export default function MassEndorseButton({
  filteredItems,
  experienceFilter,
  style,
}: MassEndorseButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isEndorsing, setIsEndorsing] = useState(false);

  const userId = useAuthStore((s) => s.user?.id);
  const hasAccount = useUserStore(selectHasAccount);
  const fullyVerified = useUserStore(selectFullyVerified);
  // Select raw districts array (stable reference from store) and derive IDs locally
  // to avoid selectUserDistrictIds creating a new array on every store update
  const districts = useUserStore((s) => s.userProfile?.districts);
  const userDistrictIds = useMemo(() => districts?.map((d) => d.id) || [], [districts]);
  const endorseCandidate = useUserStore((s) => s.endorseCandidate);
  const hasEndorsedCandidate = useUserStore((s) => s.hasEndorsedCandidate);
  const currentRoundId = useConfigStore(selectCurrentRoundId);

  // Mass endorse available on all filters
  if (filteredItems.length === 0) return null;
  if (!userId || !hasAccount || !fullyVerified) return null;

  const endorsableCandidates = filteredItems.filter((item) => {
    if (hasEndorsedCandidate(item.candidate.id)) return false;
    return userDistrictIds.includes(item.candidate.district);
  });

  if (endorsableCandidates.length === 0) return null;

  const handleMassEndorse = async () => {
    setIsEndorsing(true);
    for (const item of endorsableCandidates) {
      // Defense-in-depth: skip candidates outside user's districts
      if (!userDistrictIds.includes(item.candidate.district)) continue;
      await endorseCandidate(userId, item.candidate.id, currentRoundId);
    }
    setIsEndorsing(false);
    setShowConfirm(false);
  };

  return (
    <View style={[styles.container, style]}>
      <Button
        mode="contained"
        compact
        icon="heart-multiple"
        onPress={() => setShowConfirm(true)}
        style={styles.button}
        labelStyle={styles.label}
      >
        Endorse all {endorsableCandidates.length}
      </Button>

      {/* Only mount when needed to avoid Portal blocking tab bar */}
      {showConfirm && (
        <ConfirmModal
          visible={showConfirm}
          onDismiss={() => setShowConfirm(false)}
          onConfirm={handleMassEndorse}
          title="Mass Endorse"
          message={`Endorse ${endorsableCandidates.length} candidates matching your current filter?`}
          confirmLabel={isEndorsing ? 'Endorsing...' : 'Confirm'}
          loading={isEndorsing}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    zIndex: 100,
  },
  button: {
    borderRadius: 20,
  },
  label: {
    fontSize: 12,
    color: '#fff',
  },
});
