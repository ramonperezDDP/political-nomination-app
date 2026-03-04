import React from 'react';
import { StyleSheet, View, ScrollView, Image, Platform } from 'react-native';
import { useTheme } from 'react-native-paper';
import { SafeAreaView as NativeSafeAreaView } from 'react-native-safe-area-context';

import { useAuthStore, selectIsCandidate, useUserStore } from '@/stores';
import VoterHome from '@/components/home/VoterHome';
import CandidateHome from '@/components/home/CandidateHome';
import DistrictToggle from '@/components/home/DistrictToggle';

const SafeAreaView = Platform.OS === 'web' ? View : NativeSafeAreaView;

export default function HomeScreen() {
  const theme = useTheme();
  const isCandidate = useAuthStore(selectIsCandidate);
  const selectedDistrict = useUserStore((s) => s.selectedBrowsingDistrict);
  const setDistrict = useUserStore((s) => s.setSelectedBrowsingDistrict);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top']}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image
            source={require('../../assets/amsp-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <View style={styles.headerRight}>
          <DistrictToggle
            selectedDistrict={selectedDistrict}
            onDistrictChange={setDistrict}
          />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 160,
    height: 44,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingTop: 8,
  },
});
