import React from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuthStore, selectIsCandidate, useConfigStore } from '@/stores';
import VoterHome from '@/components/home/VoterHome';
import CandidateHome from '@/components/home/CandidateHome';
import { SearchInput } from '@/components/ui';

export default function HomeScreen() {
  const theme = useTheme();
  const isCandidate = useAuthStore(selectIsCandidate);
  const partyConfig = useConfigStore((state) => state.partyConfig);
  const [searchQuery, setSearchQuery] = React.useState('');

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

        <SearchInput
          label=""
          placeholder="Search candidates, issues..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchBar}
        />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {isCandidate ? (
          <CandidateHome searchQuery={searchQuery} />
        ) : (
          <VoterHome searchQuery={searchQuery} />
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
    marginBottom: 16,
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
  searchBar: {
    marginBottom: 0,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingTop: 8,
  },
});
