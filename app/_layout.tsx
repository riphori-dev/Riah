import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider, useTheme } from '@/constants';
import { activeSleep, babyProfile, initDatabase } from '@/db/database';
import NotificationService from '@/services/notifications';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ThemedStatusBar />
      <RootLayoutContent />
    </ThemeProvider>
  );
}

function ThemedStatusBar() {
  const { isDarkMode } = useTheme();
  return <StatusBar style={isDarkMode ? 'light' : 'dark'} />;
}

function RootLayoutContent() {
  const router = useRouter();
  const { colors } = useTheme();
  const [startupError, setStartupError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const navigationDone = useRef(false);
  const [targetRoute, setTargetRoute] = useState<string | null>(null);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        setStartupError(null);
        await initDatabase();
        // Import legacy running sleep once; never clear keys before the DB write succeeds.
        if ((await AsyncStorage.getItem('isSleeping')) === 'true') {
          const start = Number(await AsyncStorage.getItem('sleepStartTime'));
          const type = await AsyncStorage.getItem('sleepType');
          if (Number.isFinite(start) && start > 0 && start <= Date.now()) {
            await activeSleep.start(type === 'night' ? 'night' : 'nap', start);
          } else {
            throw new Error(
              'The saved sleep timer needs repair. Its saved data has been preserved.',
            );
          }
          await AsyncStorage.multiRemove(['isSleeping', 'sleepStartTime', 'sleepType']);
        }
        const profile = await babyProfile.get();
        // SQLite is authoritative. Cache failure must not masquerade as lost onboarding.
        if (profile) {
          await AsyncStorage.multiSet([
            ['onboarded', 'true'],
            ['babyName', profile.name || 'Baby'],
          ]).catch(() => {});
        }
        await AsyncStorage.setItem('appOpenTime', Date.now().toString()).catch(() => {});
        const response = await Notifications.getLastNotificationResponseAsync().catch(() => null);
        const screen = response?.notification.request.content.data?.screen;
        const allowed = ['/diaper', '/feeding', '/stock', '/appointments'];
        setTargetRoute(
          profile && typeof screen === 'string' && allowed.includes(screen)
            ? screen
            : profile
              ? '/(tabs)'
              : '/landing',
        );
        if (response) void Notifications.clearLastNotificationResponseAsync().catch(() => {});
        setIsReady(true);
        void NotificationService.initialize().catch((error) =>
          console.warn('Reminders unavailable:', error),
        );
      } catch (error) {
        setStartupError(error instanceof Error ? error.message : 'Unable to open your records.');
      }
    };

    initializeApp();
    return () => NotificationService.cleanup();
  }, [attempt]);

  // Add notification tap listener
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const screen = response.notification.request.content.data?.screen as string;
      if (isReady && ['/diaper', '/feeding', '/stock', '/appointments'].includes(screen)) {
        setTargetRoute(screen);
        router.push(screen as '/diaper');
      }
    });

    return () => subscription?.remove();
  }, [isReady, router]);

  // Wait until Stack is mounted THEN navigate
  useEffect(() => {
    if (isReady && targetRoute && !navigationDone.current) {
      navigationDone.current = true;
      router.replace(targetRoute as '/landing' | '/(tabs)');
    }
  }, [isReady, targetRoute]);

  if (startupError)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          justifyContent: 'center',
          padding: 24,
          gap: 16,
        }}
      >
        <Text
          accessibilityRole="header"
          style={{ color: colors.text, fontSize: 24, fontWeight: '700' }}
        >
          Your records could not be opened
        </Text>
        <Text accessibilityRole="alert" style={{ color: colors.text }}>
          {startupError}
        </Text>
        <Text style={{ color: colors.lightText }}>
          Your data has not been reset. Try opening it again.
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          style={{ minHeight: 48, justifyContent: 'center' }}
          onPress={() => {
            setStartupError(null);
            setAttempt((value) => value + 1);
          }}
        >
          <Text style={{ color: colors.text, fontWeight: '700' }}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  if (!isReady) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text style={{ color: colors.primary, fontSize: 24, fontWeight: 'bold' }}>Riah</Text>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 16 }} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="landing" options={{ headerShown: false }} />
          <Stack.Screen name="setup" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="settings" options={{ headerShown: false }} />
          <Stack.Screen name="about" options={{ headerShown: false }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
