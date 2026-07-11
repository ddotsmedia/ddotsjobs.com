import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { trpc, makeTrpcClient } from './src/lib/trpc';
import { useAuth } from './src/lib/auth';
import { colors } from './src/theme';
import { JobsScreen } from './src/screens/JobsScreen';
import { JobDetailScreen } from './src/screens/JobDetailScreen';
import { SavedScreen } from './src/screens/SavedScreen';
import { ChatInboxScreen } from './src/screens/ChatInboxScreen';
import { ChatThreadScreen } from './src/screens/ChatThreadScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { LoginScreen } from './src/screens/LoginScreen';

export type JobsStackParams = { JobsList: undefined; JobDetail: { slug: string; title: string } };
export type ChatStackParams = { ChatInbox: undefined; ChatThread: { conversationId: string; name: string } };
export type ProfileStackParams = { ProfileHome: undefined; Login: undefined };

const JobsStack = createNativeStackNavigator<JobsStackParams>();
const ChatStack = createNativeStackNavigator<ChatStackParams>();
const ProfileStack = createNativeStackNavigator<ProfileStackParams>();
const Tabs = createBottomTabNavigator();

const stackScreenOptions = { headerStyle: { backgroundColor: colors.dark }, headerTintColor: '#fff' } as const;

function JobsNav() {
  return (
    <JobsStack.Navigator screenOptions={stackScreenOptions}>
      <JobsStack.Screen name="JobsList" component={JobsScreen} options={{ title: 'Jobs in Kerala' }} />
      <JobsStack.Screen name="JobDetail" component={JobDetailScreen} options={({ route }) => ({ title: route.params.title })} />
    </JobsStack.Navigator>
  );
}

function ChatNav() {
  return (
    <ChatStack.Navigator screenOptions={stackScreenOptions}>
      <ChatStack.Screen name="ChatInbox" component={ChatInboxScreen} options={{ title: 'Messages' }} />
      <ChatStack.Screen name="ChatThread" component={ChatThreadScreen} options={({ route }) => ({ title: route.params.name })} />
    </ChatStack.Navigator>
  );
}

function ProfileNav() {
  return (
    <ProfileStack.Navigator screenOptions={stackScreenOptions}>
      <ProfileStack.Screen name="ProfileHome" component={ProfileScreen} options={{ title: 'Profile' }} />
      <ProfileStack.Screen name="Login" component={LoginScreen} options={{ title: 'Sign in' }} />
    </ProfileStack.Navigator>
  );
}

const tabIcon = (emoji: string) => ({ color }: { color: string }) => <Text style={{ fontSize: 20, color }}>{emoji}</Text>;

export default function App() {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } }));
  const [trpcClient] = useState(() => makeTrpcClient());
  const hydrate = useAuth((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <NavigationContainer>
            <Tabs.Navigator
              screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: colors.accent,
                tabBarInactiveTintColor: colors.faint,
              }}
            >
              <Tabs.Screen name="Jobs" component={JobsNav} options={{ tabBarIcon: tabIcon('🏠') }} />
              <Tabs.Screen name="Saved" component={SavedScreen} options={{ tabBarIcon: tabIcon('🔖') }} />
              <Tabs.Screen name="Chat" component={ChatNav} options={{ tabBarIcon: tabIcon('💬') }} />
              <Tabs.Screen name="Profile" component={ProfileNav} options={{ tabBarIcon: tabIcon('👤') }} />
            </Tabs.Navigator>
          </NavigationContainer>
        </SafeAreaProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
