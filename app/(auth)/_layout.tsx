import { Stack, Redirect } from 'expo-router';
import { useTheme } from 'react-native-paper';

import { useAuthStore, selectIsAuthenticated, selectHasCompletedOnboarding, useUserStore } from '@/stores';

export default function AuthLayout() {
  const theme = useTheme();
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const hasCompletedOnboarding = useUserStore(selectHasCompletedOnboarding);

  // Wait for auth to initialize
  if (!isInitialized) {
    return null;
  }

  // If authenticated and completed onboarding, redirect to tabs
  if (isAuthenticated && hasCompletedOnboarding) {
    return <Redirect href="/(tabs)" />;
  }

  // If authenticated but hasn't completed onboarding, let them continue in auth flow
  // (they'll be directed to onboarding screens)

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
        name="login"
        options={{
          title: 'Sign In',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="register"
        options={{
          title: 'Create Account',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="verify-identity"
        options={{
          title: 'Verify Identity',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="onboarding/issues"
        options={{
          title: 'Select Issues',
          headerBackVisible: false,
        }}
      />
      <Stack.Screen
        name="onboarding/questionnaire"
        options={{
          title: 'Questionnaire',
          headerBackTitle: 'Issues',
        }}
      />
      <Stack.Screen
        name="onboarding/dealbreakers"
        options={{
          title: 'Dealbreakers',
          headerBackTitle: 'Back',
        }}
      />
    </Stack>
  );
}
