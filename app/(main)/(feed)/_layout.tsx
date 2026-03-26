import { Stack } from 'expo-router';
import AppHeader from '@/components/layout/AppHeader';

export default function FeedLayout() {
  return (
    <Stack screenOptions={{ header: () => <AppHeader /> }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="candidate/[id]" options={{ headerShown: true, headerTitle: 'Candidate Profile', headerBackTitle: 'Back' }} />
    </Stack>
  );
}
