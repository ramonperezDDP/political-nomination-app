import React from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuthStore, selectIsCandidate, useConfigStore } from '@/stores';
import VoterHome from '@/components/home/VoterHome';
import CandidateHome from '@/components/home/CandidateHome';

export default function HomeScreen() {
  const theme = useTheme();
  const isCandidate = useAuthStore(selectIsCandidate);
  const partyConfig = useConfigStore((state) => state.partyConfig);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top']}
    >
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <View style={[styles.logo, { backgroundColor: theme.colors.primary }]}>
            <Text variant="titleLarge" style={styles.logoText}>
              PN
            </Text>
          </View>
          <View style={styles.titleContainer}>
            <Text variant="titleLarge" style={styles.appTitle}>
              {partyConfig?.partyName || 'Political Nomination'}
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
              {partyConfig?.tagline || 'Your voice matters'}
            </Text>
          </View>
        </View>
      </View>

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  titleContainer: {
    marginLeft: 12,
  },
  appTitle: {
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingTop: 8,
  },
});
