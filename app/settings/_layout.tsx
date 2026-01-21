import { Stack } from 'expo-router';
import { useTheme } from 'react-native-paper';

export default function SettingsLayout() {
  const theme = useTheme();

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
        name="dealbreakers"
        options={{
          title: 'Manage Dealbreakers',
          headerBackTitle: 'Profile',
        }}
      />
      <Stack.Screen
        name="issues"
        options={{
          title: 'Policy Preferences',
          headerBackTitle: 'Profile',
        }}
      />
    </Stack>
  );
}
