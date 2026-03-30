import { Stack } from 'expo-router';
import AppHeader from '@/components/layout/AppHeader';

export default function FeedLayout() {
  return (
    <Stack screenOptions={{ header: () => <AppHeader /> }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="candidate/[id]" options={{ header: () => <AppHeader hideDistrictPicker />, headerTitle: 'Candidate Profile', headerBackTitle: 'Back' }} />
    </Stack>
  );
}
