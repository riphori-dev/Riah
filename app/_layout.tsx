import React, { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, View, Text } from 'react-native';
import * as Notifications from 'expo-notifications';

import { Colors } from '@/constants';
import { initDatabase } from '@/db/database';
import NotificationService from '@/services/notifications';

export default function RootLayout() {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [targetRoute, setTargetRoute] = useState<string | null>(null);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        await initDatabase();
        await NotificationService.initialize();

        // Save app open time for notification service
        await AsyncStorage.setItem('appOpenTime', Date.now().toString());

        const onboarded = await AsyncStorage.getItem('onboarded');
        console.log('onboarded value:', onboarded);

        setTargetRoute(onboarded === 'true' ? '/(tabs)' : '/landing');
      } catch (error) {
        console.error('Init error:', error);
        setTargetRoute('/landing');
      } finally {
        setIsReady(true);
      }
    };

    initializeApp();
  }, []);

  // Add notification tap listener
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const screen = response.notification.request.content.data?.screen as string;
      if (screen) router.push(screen);
    });

    return () => subscription?.remove();
  }, []);

  // Wait until Stack is mounted THEN navigate
  useEffect(() => {
    if (isReady && targetRoute) {
      const timeout = setTimeout(() => {
        router.replace(targetRoute);
      }, 100); // small delay lets the Stack render first
      return () => clearTimeout(timeout);
    }
  }, [isReady, targetRoute]);

  if (!isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: Colors.primary, fontSize: 24, fontWeight: 'bold' }}>Riah</Text>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 16 }} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: Colors.background },
            animation: 'slide_from_right'
          }}
        >
          <Stack.Screen name="landing" options={{ headerShown: false }} />
          <Stack.Screen name="setup" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}