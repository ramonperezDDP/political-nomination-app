import React, { useEffect } from 'react';
import { Stack, Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StyleSheet, Platform, View, Text as RNText } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  NunitoSans_400Regular,
  NunitoSans_700Bold,
  NunitoSans_900Black,
} from '@expo-google-fonts/nunito-sans';

import { enableScreens } from 'react-native-screens';
import { useAuthStore, useConfigStore, useUserStore } from '@/stores';
import { amspLightTheme } from '@/constants/theme';

// Disable native screens on web to avoid CSSStyleDeclaration errors
// from react-native-screens' Animated wrapper
if (Platform.OS === 'web') {
  enableScreens(false);
}

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

// Error boundary to catch and display runtime errors on web
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App Error Boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#fff' }}>
          <RNText style={{ fontSize: 18, fontWeight: 'bold', color: '#c00', marginBottom: 10 }}>
            Something went wrong
          </RNText>
          <RNText style={{ fontSize: 14, color: '#333', textAlign: 'center' }}>
            {this.state.error?.message || 'Unknown error'}
          </RNText>
          <RNText style={{ fontSize: 12, color: '#666', marginTop: 10, textAlign: 'center' }}>
            {this.state.error?.stack?.slice(0, 500) || ''}
          </RNText>
        </View>
      );
    }
    return this.props.children;
  }
}

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

  const content = (
    <Stack screenOptions={{
      headerShown: false,
      ...(Platform.OS === 'web' ? { animation: 'none' } : {}),
    }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(candidate)" />
      <Stack.Screen
        name="candidate/[id]"
        options={{
          headerShown: true,
          headerTitle: 'Candidate Profile',
          headerBackTitle: 'Back',
          ...(Platform.OS === 'web' ? { animation: 'none' } : {}),
        }}
      />
    </Stack>
  );

  // On web, use a simplified wrapper
  if (Platform.OS === 'web') {
    return (
      <ErrorBoundary>
        <View style={styles.container}>
          <QueryClientProvider client={queryClient}>
            <PaperProvider theme={theme}>
              <Slot />
            </PaperProvider>
          </QueryClientProvider>
        </View>
      </ErrorBoundary>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <PaperProvider theme={theme}>
            <StatusBar style="dark" />
            {content}
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
