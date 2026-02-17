import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  NunitoSans_400Regular,
  NunitoSans_700Bold,
  NunitoSans_900Black,
} from '@expo-google-fonts/nunito-sans';

import { useAuthStore, useConfigStore, useUserStore } from '@/stores';
import { amspLightTheme } from '@/constants/theme';

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

// Create query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

export default function RootLayout() {
  const initializeAuth = useAuthStore((state) => state.initialize);
  const isAuthInitialized = useAuthStore((state) => state.isInitialized);
  const user = useAuthStore((state) => state.user);
  const initializeConfig = useConfigStore((state) => state.initialize);
  const fetchEndorsements = useUserStore((state) => state.fetchEndorsements);

  const [fontsLoaded] = useFonts({
    NunitoSans_400Regular,
    NunitoSans_700Bold,
    NunitoSans_900Black,
  });

  useEffect(() => {
    // Initialize auth listener
    const unsubscribeAuth = initializeAuth();

    // Initialize config listener
    const unsubscribeConfig = initializeConfig();

    return () => {
      unsubscribeAuth();
      unsubscribeConfig();
    };
  }, [initializeAuth, initializeConfig]);

  // Fetch endorsements when user is authenticated
  useEffect(() => {
    if (user?.id) {
      fetchEndorsements(user.id);
    }
  }, [user?.id, fetchEndorsements]);

  useEffect(() => {
    if (isAuthInitialized && fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [isAuthInitialized, fontsLoaded]);

  const theme = amspLightTheme;

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <PaperProvider theme={theme}>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(candidate)" />
              <Stack.Screen
                name="candidate/[id]"
                options={{
                  headerShown: true,
                  headerTitle: 'Candidate Profile',
                  headerBackTitle: 'Back',
                }}
              />
            </Stack>
          </PaperProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
