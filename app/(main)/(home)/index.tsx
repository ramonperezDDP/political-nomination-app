import React from 'react';
import { StyleSheet, View, ScrollView, Platform } from 'react-native';
import { useTheme } from 'react-native-paper';

import { useAuthStore, selectIsCandidate } from '@/stores';
import VoterHome from '@/components/home/VoterHome';
import CandidateHome from '@/components/home/CandidateHome';

export default function HomeScreen() {
  const theme = useTheme();
  const isCandidate = useAuthStore(selectIsCandidate);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {isCandidate ? (
          <CandidateHome />
        ) : (
          <VoterHome />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingTop: 8,
  },
});
