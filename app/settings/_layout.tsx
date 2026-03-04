import { Stack, router } from 'expo-router';
import { useTheme } from 'react-native-paper';
import { Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable } from 'react-native';

export default function SettingsLayout() {
  const theme = useTheme();

  const headerLeft = () => (
    <Pressable onPress={() => router.back()} hitSlop={8} style={{ marginRight: 8 }}>
      <MaterialCommunityIcons
        name={Platform.OS === 'ios' ? 'chevron-left' : 'arrow-left'}
        size={Platform.OS === 'ios' ? 32 : 24}
        color={theme.colors.onSurface}
      />
    </Pressable>
  );

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
        headerLeft,
      }}
    >
      <Stack.Screen
        name="personal-info"
        options={{
          title: 'Personal Information',
          headerBackTitle: 'Profile',
        }}
      />
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
      <Stack.Screen
        name="endorsements"
        options={{
          title: 'My Endorsements',
          headerBackTitle: 'Profile',
        }}
      />
    </Stack>
  );
}
