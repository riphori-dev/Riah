import ScreenFeedback from '@/components/ScreenFeedback';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { ImpactFeedbackStyle } from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  AppState,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BabyIllustration from '@/components/BabyIllustration';
import type { Appointment, BabyProfile, DiaperLog, FeedingLog, SleepLog } from '@/db/database';
import { Spacing, useTheme, useThemedStyles } from '@/constants';
import {
  activeSleep,
  appointments,
  babyProfile,
  diaperLogs,
  feedingLogs,
  sleepLogs,
  stockItems,
} from '@/db/database';
import { ageInMonths, parseBirthdate } from '@/utils/care';
import { getTimeAgo } from '@/utils/timeUtils';

export default function HomeScreen() {
  const { colors: Colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, isDarkMode } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [, setTimerTick] = useState(0);
  const [babyName, setBabyName] = useState('Baby');
  const [data, setData] = useState({
    babyInfo: null as BabyProfile | null,
    lastDiaper: null as DiaperLog | null,
    lastFeeding: null as FeedingLog | null,
    lastSleep: null as SleepLog | null,
    diaperTimestamp: null as string | null, // Raw ISO timestamp
    feedingTimestamp: null as string | null, // Raw ISO timestamp
    todayStats: {
      diapers: 0,
      feeds: 0,
      sleep: 0,
    },
    lowStockCount: 0,
    stockCount: 0,
    upcomingAppointment: null as Appointment | null,
    isCurrentlySleeping: false,
  });

  // Get greeting based on time of day
  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Convert number timestamp to ISO string if needed, then calculate time ago
  const formatTimestampAgo = (timestamp: number | null): string => {
    if (!timestamp) return '--';
    const isoTimestamp = new Date(timestamp).toISOString();
    return getTimeAgo(isoTimestamp);
  };

  // Format duration
  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  // Load all data
  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [
        babyInfo,
        lastDiaper,
        lastFeeding,
        lastSleep,
        todayDiapers,
        todayFeeds,
        todaySleep,
        stockItemsList,
        upcomingAppts,
        currentSession,
      ] = await Promise.all([
        babyProfile.get(),
        diaperLogs.getRecent(1),
        feedingLogs.getRecent(1),
        sleepLogs.getRecent(1),
        diaperLogs.getTodayCount(),
        feedingLogs.getTodayCount(),
        sleepLogs.getTodayTotal(),
        stockItems.getAll(),
        appointments.getUpcoming(7),
        activeSleep.get(),
      ]);

      // Check if currently sleeping
      const isCurrentlySleeping = !!currentSession;

      // Count low stock items
      const lowStockCount = stockItemsList.filter(
        (item) => item.quantity <= item.low_stock_threshold,
      ).length;

      // Store raw timestamps for fresh calculation on every render
      const diaperTimestamp = lastDiaper[0]
        ? new Date(lastDiaper[0].timestamp).toISOString()
        : null;
      const feedingTimestamp = lastFeeding[0]
        ? new Date(lastFeeding[0].timestamp).toISOString()
        : null;

      if (babyInfo?.birthdate) {
        try {
          babyInfo.age_months = ageInMonths(parseBirthdate(babyInfo.birthdate));
        } catch {}
      }

      // Set baby name from database
      setBabyName(babyInfo?.name ?? 'Baby');

      setData({
        babyInfo,
        lastDiaper: lastDiaper[0] || null,
        lastFeeding: lastFeeding[0] || null,
        lastSleep: lastSleep[0] || null,
        diaperTimestamp,
        feedingTimestamp,
        todayStats: {
          diapers: todayDiapers,
          feeds: todayFeeds,
          sleep: todaySleep,
        },
        lowStockCount,
        stockCount: stockItemsList.length,
        upcomingAppointment: upcomingAppts[0] || null,
        isCurrentlySleeping,
      });

      // Redirect to landing if no baby profile
      if (!babyInfo) {
        router.replace('/landing');
      }
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : 'Unable to load your records. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Listen for app state changes - recalculate timers when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        // App came back to foreground — recalculate everything immediately
        loadData();
        setTimerTick((prev) => prev + 1); // Force re-render with fresh timer calculations
      }
    });
    return () => subscription.remove();
  }, [loadData]);

  // Update live timers every minute (just trigger re-render)
  useEffect(() => {
    const interval = setInterval(() => {
      setTimerTick((prev) => prev + 1);
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // Load data on focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const getTodayDate = (): string => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: Colors.background }]}
      contentContainerStyle={{ paddingBottom: 100 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
      }
    >
      <ScreenFeedback
        loading={loading}
        error={loadError}
        onRetry={loadError ? () => loadData() : undefined}
      />

      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.greeting, { color: colors.lightText }]}>{getGreeting()} 👋</Text>
          <Text style={[styles.riahTitle, { color: colors.text }]}>Riah</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            style={[
              styles.iconButton,
              { backgroundColor: isDarkMode ? colors.card : Colors.softPrimary },
            ]}
            onPress={() => router.push('/settings')}
          >
            <Ionicons name="settings-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <View
        style={[
          styles.heroCard,
          { backgroundColor: isDarkMode ? colors.card : Colors.softPrimary },
        ]}
      >
        <View style={styles.heroLeft}>
          <Text style={[styles.heroSubtitle, { color: colors.lightText }]}>{babyName} is</Text>
          {data.babyInfo ? (
            <Text style={[styles.heroAge, { color: colors.text }]}>
              {data.babyInfo.age_months} month{data.babyInfo.age_months !== 1 ? 's' : ''} old
            </Text>
          ) : (
            <Text style={[styles.heroAge, { color: colors.text }]}>--</Text>
          )}
          <Text style={[styles.heroDate, { color: colors.lightText }]}>{getTodayDate()}</Text>
        </View>
        <View style={styles.heroRight}>
          <BabyIllustration />
        </View>
        <View style={styles.heroStats}>
          <View
            style={[
              styles.statPill,
              { backgroundColor: isDarkMode ? colors.background : Colors.card },
            ]}
          >
            <Text style={[styles.statPillText, { color: colors.text }]}>
              💧 {getTimeAgo(data.diaperTimestamp)}
            </Text>
          </View>
          <View
            style={[
              styles.statPill,
              { backgroundColor: isDarkMode ? colors.background : Colors.card },
            ]}
          >
            <Text style={[styles.statPillText, { color: colors.text }]}>
              🍼 {getTimeAgo(data.feedingTimestamp)}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.lightText }]}>Quick log</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <TouchableOpacity
            accessibilityRole="button"
            style={[
              styles.quickLogButton,
              { backgroundColor: isDarkMode ? '#173145' : Colors.softBlue },
            ]}
            onPress={() => {
              Haptics.impactAsync(ImpactFeedbackStyle.Light);
              router.push('/(tabs)/diaper');
            }}
          >
            <Text style={[styles.quickLogButtonText, { color: colors.text }]}>💧 Diaper</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            style={[
              styles.quickLogButton,
              { backgroundColor: isDarkMode ? '#3A2720' : Colors.softPrimary },
            ]}
            onPress={() => {
              Haptics.impactAsync(ImpactFeedbackStyle.Light);
              router.push('/(tabs)/feeding');
            }}
          >
            <Text style={[styles.quickLogButtonText, { color: colors.text }]}>🍼 Feed</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            style={[
              styles.quickLogButton,
              { backgroundColor: isDarkMode ? '#203321' : Colors.softGreen },
            ]}
            onPress={() => {
              Haptics.impactAsync(ImpactFeedbackStyle.Light);
              router.push('/(tabs)/sleep');
            }}
          >
            <Text style={[styles.quickLogButtonText, { color: colors.text }]}>😴 Sleep</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            style={[
              styles.quickLogButton,
              { backgroundColor: isDarkMode ? '#3A2D18' : Colors.softYellow },
            ]}
            onPress={() => {
              Haptics.impactAsync(ImpactFeedbackStyle.Light);
              router.push('/(tabs)/stock');
            }}
          >
            <Text style={[styles.quickLogButtonText, { color: colors.text }]}>📦 Stock</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.lightText }]}>Today's summary</Text>
        <View style={styles.cardsGrid}>
          <View
            style={[
              styles.statusCard,
              { backgroundColor: colors.card, borderLeftColor: '#5BA8D4', borderLeftWidth: 4 },
            ]}
          >
            <Text style={[styles.statusCardValue, { color: colors.text }]}>
              {getTimeAgo(data.diaperTimestamp)}
            </Text>
            <Text style={[styles.statusCardSubtext, { color: colors.lightText }]}>
              {data.lastDiaper
                ? `${data.lastDiaper.type.charAt(0).toUpperCase() + data.lastDiaper.type.slice(1)} · ${data.todayStats.diapers} ${data.todayStats.diapers === 1 ? 'change' : 'changes'} today`
                : 'No changes today'}
            </Text>
          </View>

          <View
            style={[
              styles.statusCard,
              { backgroundColor: colors.card, borderLeftColor: colors.primary, borderLeftWidth: 4 },
            ]}
          >
            <Text style={[styles.statusCardValue, { color: colors.text }]}>
              {getTimeAgo(data.feedingTimestamp)}
            </Text>
            <Text style={[styles.statusCardSubtext, { color: colors.lightText }]}>
              {data.lastFeeding
                ? `${data.lastFeeding.type.charAt(0).toUpperCase() + data.lastFeeding.type.slice(1)} · ${data.todayStats.feeds} ${data.todayStats.feeds === 1 ? 'feed' : 'feeds'} today`
                : 'No feeds today'}
            </Text>
          </View>

          <View
            style={[
              styles.statusCard,
              {
                backgroundColor: colors.card,
                borderLeftColor: colors.secondary,
                borderLeftWidth: 4,
              },
            ]}
          >
            <Text style={[styles.statusCardValue, { color: colors.text }]}>
              {data.todayStats.sleep > 0 ? formatDuration(data.todayStats.sleep) : '--'}
            </Text>
            <Text style={[styles.statusCardSubtext, { color: colors.lightText }]}>
              {data.isCurrentlySleeping
                ? 'Sleeping now 🌙'
                : data.lastSleep
                  ? `Last nap: ${formatTimestampAgo(data.lastSleep.start_time)}`
                  : 'No sleep logged'}
            </Text>
          </View>

          <View
            style={[
              styles.statusCard,
              { backgroundColor: colors.card, borderLeftColor: colors.accent, borderLeftWidth: 4 },
            ]}
          >
            <Text style={[styles.statusCardValue, { color: colors.text }]}>
              {data.stockCount === 0
                ? 'No supplies yet'
                : data.lowStockCount > 0
                  ? `${data.lowStockCount} items low`
                  : 'All stocked ✓'}
            </Text>
            <Text style={[styles.statusCardSubtext, { color: colors.lightText }]}>
              {data.stockCount === 0
                ? 'Add supplies in Stock'
                : `${data.stockCount} ${data.stockCount === 1 ? 'item' : 'items'} tracked`}
            </Text>
          </View>
        </View>
      </View>

      {data.upcomingAppointment && (
        <View style={styles.section}>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.appointmentCard}
            onPress={() => router.push('/(tabs)/appointments')}
            activeOpacity={0.7}
          >
            <View style={styles.appointmentIcon}>
              <MaterialCommunityIcons name="calendar" size={24} color="#3B6D11" />
            </View>
            <View style={styles.appointmentInfo}>
              <Text style={styles.appointmentTitle}>{data.upcomingAppointment.title}</Text>
              <Text style={styles.appointmentDate}>
                {(() => {
                  const aptDate = new Date(data.upcomingAppointment.date);
                  const today = new Date();
                  const tomorrow = new Date(today);
                  tomorrow.setDate(tomorrow.getDate() + 1);

                  if (aptDate.toDateString() === tomorrow.toDateString()) {
                    return `Tomorrow at ${aptDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
                  }

                  return aptDate.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                  });
                })()}
              </Text>
              {data.upcomingAppointment.doctor_name && (
                <Text style={styles.appointmentDoctor}>
                  Dr. {data.upcomingAppointment.doctor_name}
                </Text>
              )}
            </View>
            <View style={styles.appointmentRight}>
              {Math.ceil((data.upcomingAppointment.date - Date.now()) / (1000 * 60 * 60 * 24)) <=
                3 && (
                <View style={styles.soonBadge}>
                  <Text style={styles.soonBadgeText}>Soon</Text>
                </View>
              )}
              <MaterialCommunityIcons name="chevron-right" size={20} color="#3B6D11" />
            </View>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const createStyles = (Colors: typeof import('@/constants').Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    // Header styles
    header: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.lg,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    headerLeft: {
      flex: 1,
    },
    greeting: {
      fontSize: 13,
      color: Colors.lightText,
      fontWeight: '500',
    },
    riahTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: Colors.text,
      marginTop: 2,
    },
    headerRight: {
      flexDirection: 'row',
      gap: 8,
    },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: Colors.softPrimary,
      borderWidth: 0.5,
      borderColor: '#F4A98A',
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Hero card styles
    heroCard: {
      marginHorizontal: Spacing.lg,
      backgroundColor: Colors.softPrimary,
      borderRadius: 24,
      padding: 20,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      shadowColor: '#F4A98A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 3,
    },
    heroLeft: {
      flexGrow: 1,
      flexBasis: 140,
      minWidth: 0,
    },
    heroSubtitle: {
      fontSize: 12,
      color: Colors.lightText,
      fontWeight: '500',
    },
    heroAge: {
      fontSize: 26,
      fontWeight: '700',
      color: Colors.text,
      marginTop: 4,
    },
    heroDate: {
      fontSize: 12,
      color: Colors.lightText,
      marginTop: 4,
    },
    heroStats: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      width: '100%',
      marginTop: 12,
      gap: 8,
    },
    statPill: {
      maxWidth: '100%',
      flexShrink: 1,
      backgroundColor: Colors.card,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
    },
    statPillText: {
      fontSize: 11,
      fontWeight: '500',
      color: Colors.text,
    },
    heroRight: {
      width: 130,
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Section styles
    section: {
      marginTop: Spacing.xl,
      paddingHorizontal: Spacing.lg,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: Colors.lightText,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: Spacing.md,
    },
    // Quick log styles
    quickLogButton: {
      width: '48%',
      minHeight: 48,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 999,
    },
    quickLogButtonText: {
      fontSize: 13,
      fontWeight: '500',
    },
    // Status cards grid
    cardsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: 12,
    },
    statusCard: {
      width: '47%',
      flexGrow: 1,
      backgroundColor: Colors.card,
      borderRadius: 20,
      padding: 16,
      shadowColor: '#F4A98A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 3,
    },
    statusCardValue: {
      fontSize: 18,
      fontWeight: '700',
      color: Colors.text,
      marginBottom: 4,
    },
    statusCardSubtext: {
      fontSize: 12,
      color: Colors.lightText,
      lineHeight: 16,
    },
    // Appointment card styles
    appointmentCard: {
      backgroundColor: Colors.softGreen,
      borderRadius: 20,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      shadowColor: '#F4A98A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 3,
    },
    appointmentIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: '#A8D5BA',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    appointmentInfo: {
      flex: 1,
    },
    appointmentTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: Colors.text,
      marginBottom: 2,
    },
    appointmentDate: {
      fontSize: 14,
      color: Colors.successText,
      fontWeight: '500',
      marginBottom: 2,
    },
    appointmentDoctor: {
      fontSize: 12,
      color: Colors.lightText,
    },
    appointmentRight: {
      alignItems: 'flex-end',
      gap: 4,
    },
    soonBadge: {
      backgroundColor: '#F9C784',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
    },
    soonBadgeText: {
      fontSize: 10,
      fontWeight: '600',
      color: '#FFF',
    },
  });
