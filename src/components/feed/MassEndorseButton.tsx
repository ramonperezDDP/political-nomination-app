import React, { useState } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Button } from 'react-native-paper';
import { useAuthStore } from '@/stores';
import { useUserStore, selectFullyVerified, selectHasAccount, selectUserDistrictIds } from '@/stores';
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
  const userDistrictIds = useUserStore(selectUserDistrictIds);
  const endorseCandidate = useUserStore((s) => s.endorseCandidate);
  const hasEndorsedCandidate = useUserStore((s) => s.hasEndorsedCandidate);

  if (experienceFilter === 'random') return null;
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
      await endorseCandidate(userId, item.candidate.id);
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

      <ConfirmModal
        visible={showConfirm}
        onDismiss={() => setShowConfirm(false)}
        onConfirm={handleMassEndorse}
        title="Mass Endorse"
        message={`Endorse ${endorsableCandidates.length} candidates matching your current filter?`}
        confirmLabel={isEndorsing ? 'Endorsing...' : 'Confirm'}
        loading={isEndorsing}
      />
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
