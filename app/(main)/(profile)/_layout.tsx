import { Stack } from 'expo-router';
import { useTheme } from 'react-native-paper';
import AppHeader from '@/components/layout/AppHeader';

export default function ProfileLayout() {
  const theme = useTheme();

  return (
    <Stack screenOptions={{ header: () => <AppHeader /> }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="personal-info" options={{ header: () => <AppHeader showBack /> }} />
      <Stack.Screen name="issues" options={{ header: () => <AppHeader showBack /> }} />
      <Stack.Screen name="endorsements" options={{ header: () => <AppHeader showBack /> }} />
    </Stack>
  );
}
