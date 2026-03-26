import { Stack, Slot, Redirect } from 'expo-router';
import { Platform } from 'react-native';
import { useTheme } from 'react-native-paper';

import { useAuthStore, selectIsAuthenticated } from '@/stores';

export default function AuthLayout() {
  const theme = useTheme();
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const user = useAuthStore((state) => state.user);

  // Wait for auth to initialize
  if (!isInitialized) {
    return null;
  }

  // If authenticated with a non-anonymous account, redirect to tabs
  // Anonymous users can also access tabs (handled by tabs layout)
  // but they should be able to reach auth screens to register/login
  if (isAuthenticated && user && !user.isAnonymous) {
    return <Redirect href="/(main)" />;
  }

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
