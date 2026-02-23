import { Stack, Slot, Redirect } from 'expo-router';
import { Platform } from 'react-native';
import { useTheme } from 'react-native-paper';

import { useAuthStore, selectIsAuthenticated, selectIsCandidate } from '@/stores';

export default function CandidateLayout() {
  const theme = useTheme();
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const isCandidate = useAuthStore(selectIsCandidate);
  const userState = useAuthStore((state) => state.user?.state);

  // Wait for auth to initialize
  if (!isInitialized) {
    return null;
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  // Allow access to apply screen for all verified users
  // Other screens only for approved candidates

  // On web, use Slot to avoid react-native-screens animated style issues
  if (Platform.OS === 'web') {
    return <Slot />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.surface,
        },
        headerTintColor: theme.colors.onSurface,
        headerShadowVisible: false,
        contentStyle: {
          backgroundColor: theme.colors.background,
        },
      }}
    >
      <Stack.Screen
        name="apply"
        options={{
          title: 'Run for Office',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="creation"
        options={{
          title: 'Profile Editor',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="metrics"
        options={{
          title: 'Campaign Metrics',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="messages"
        options={{
          title: 'Messages',
          headerBackTitle: 'Back',
        }}
      />
    </Stack>
  );
}
