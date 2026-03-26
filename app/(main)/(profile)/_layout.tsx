import { Stack } from 'expo-router';
import { useTheme } from 'react-native-paper';

export default function ProfileLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.onSurface,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="personal-info" options={{ title: 'Personal Information' }} />
      <Stack.Screen name="issues" options={{ title: 'Policy Preferences' }} />
      <Stack.Screen name="endorsements" options={{ title: 'My Endorsements' }} />
    </Stack>
  );
}
