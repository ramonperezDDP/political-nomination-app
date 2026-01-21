import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider, MD3DarkTheme, MD3LightTheme } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useColorScheme, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';

import { useAuthStore, useConfigStore } from '@/stores';

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

// Custom theme colors
const customColors = {
  primary: '#1a1a2e',
  secondary: '#4a4a6e',
  tertiary: '#e94560',
  surface: '#16213e',
  background: '#0f0f23',
  error: '#cf6679',
  onPrimary: '#ffffff',
  onSecondary: '#ffffff',
  onSurface: '#ffffff',
  onBackground: '#ffffff',
};

const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    ...customColors,
  },
};

const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: customColors.primary,
    secondary: customColors.secondary,
    tertiary: customColors.tertiary,
  },
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const initializeAuth = useAuthStore((state) => state.initialize);
  const isAuthInitialized = useAuthStore((state) => state.isInitialized);
  const initializeConfig = useConfigStore((state) => state.initialize);

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

  useEffect(() => {
    if (isAuthInitialized) {
      SplashScreen.hideAsync();
    }
  }, [isAuthInitialized]);

  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <PaperProvider theme={theme}>
            <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
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
