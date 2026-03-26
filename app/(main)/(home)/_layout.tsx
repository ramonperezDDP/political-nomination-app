import { Stack } from 'expo-router';
import AppHeader from '@/components/layout/AppHeader';

export default function HomeLayout() {
  return (
    <Stack screenOptions={{ header: () => <AppHeader /> }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
