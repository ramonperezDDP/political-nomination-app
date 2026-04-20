import { Tabs, router } from 'expo-router';
import { Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from 'react-native-paper';
import { useAuthStore } from '@/stores';

// On web, tapping an already-focused tab does NOT pop its stack to the
// root route (unlike iOS). That leaves users stranded on nested routes
// like /(main)/(feed)/candidate/[id] with no way back to the feed index.
// Intercept tabPress on web and hard-route to the tab root so every tap
// behaves like the iOS "pop to root" shortcut.
const resetToTabRoot = (rootPath: string) => ({
  tabPress: (e: any) => {
    if (Platform.OS !== 'web') return;
    e.preventDefault();
    router.replace(rootPath as any);
  },
});

export const unstable_settings = {
  initialRouteName: '(home)',
};

export default function MainLayout() {
  const theme = useTheme();
  const isInitialized = useAuthStore((state) => state.isInitialized);

  if (!isInitialized) {
    return null;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.outline,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.outlineVariant,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="(home)"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'home' : 'home-outline'}
              size={24}
              color={color}
            />
          ),
        }}
        listeners={resetToTabRoot('/(main)/(home)')}
      />
      <Tabs.Screen
        name="(feed)"
        options={{
          title: 'For You',
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'cards' : 'cards-outline'}
              size={24}
              color={color}
            />
          ),
        }}
        listeners={resetToTabRoot('/(main)/(feed)')}
      />
      <Tabs.Screen
        name="(leaderboard)"
        options={{
          title: 'Leaderboard',
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'trophy' : 'trophy-outline'}
              size={24}
              color={color}
            />
          ),
        }}
        listeners={resetToTabRoot('/(main)/(leaderboard)')}
      />
      <Tabs.Screen
        name="(profile)"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'account' : 'account-outline'}
              size={24}
              color={color}
            />
          ),
        }}
        listeners={resetToTabRoot('/(main)/(profile)')}
      />
      <Tabs.Screen
        name="quiz"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
