import React from 'react';
import { StyleSheet, View, ScrollView, Image } from 'react-native';
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
          <Image
            source={require('../../assets/amsp-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <View style={styles.titleContainer}>
            <Text variant="titleLarge" style={styles.appTitle}>
              {partyConfig?.partyName || "America's Main Street Party"}
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
    width: 120,
    height: 48,
    borderRadius: 8,
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
