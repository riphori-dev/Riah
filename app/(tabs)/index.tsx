import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Animated,
  Dimensions,
  AppState,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Colors, Spacing } from '@/constants';
import { diaperLogs, feedingLogs, sleepLogs, stockItems, appointments, babyProfile } from '@/db/database';
import BabyIllustration from '@/components/BabyIllustration';
import QuickLogModals from '@/components/QuickLogModals';
import { getTimeAgo } from '@/utils/timeUtils';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [timerTick, setTimerTick] = useState(0); // Force re-render on timer update
  const [data, setData] = useState({
    babyInfo: null as any,
    lastDiaper: null as any,
    lastFeeding: null as any,
    lastSleep: null as any,
    diaperTimestamp: null as string | null, // Raw ISO timestamp
    feedingTimestamp: null as string | null, // Raw ISO timestamp
    todayStats: {
      diapers: 0,
      feeds: 0,
      sleep: 0,
    },
    lowStockCount: 0,
    upcomingAppointment: null as any,
    isCurrentlySleeping: false,
  });

  // Quick Log modals state
  const [diaperModalVisible, setDiaperModalVisible] = useState(false);
  const [feedingModalVisible, setFeedingModalVisible] = useState(false);
  const [sleepModalVisible, setSleepModalVisible] = useState(false);
  const [stockModalVisible, setStockModalVisible] = useState(false);

  const successAnimation = useRef(new Animated.Value(0)).current;

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
        todaySleepLogs
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
        sleepLogs.getTodayLogs(),
      ]);

      // Check if currently sleeping
      const isCurrentlySleeping = todaySleepLogs.some((log: any) => log.end_time > Date.now());
      
      // Count low stock items
      const lowStockCount = stockItemsList.filter((item: any) => item.quantity < item.low_stock_threshold).length;

      // Store raw timestamps for fresh calculation on every render
      const diaperTimestamp = lastDiaper[0] ? new Date(lastDiaper[0].timestamp).toISOString() : null;
      const feedingTimestamp = lastFeeding[0] ? new Date(lastFeeding[0].timestamp).toISOString() : null;

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
        upcomingAppointment: upcomingAppts[0] || null,
        isCurrentlySleeping,
      });

      // Redirect to landing if no baby profile
      if (!babyInfo) {
        router.replace('/landing');
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  }, [router]);

  // Listen for app state changes - recalculate timers when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        // App came back to foreground — recalculate everything immediately
        loadData();
        setTimerTick(prev => prev + 1); // Force re-render with fresh timer calculations
      }
    });
    return () => subscription.remove();
  }, [loadData]);

  // Update live timers every minute (just trigger re-render)
  useEffect(() => {
    const interval = setInterval(() => {
      setTimerTick(prev => prev + 1);
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // Load data on focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const triggerSuccessAnimation = () => {
    Animated.sequence([
      Animated.timing(successAnimation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(successAnimation, {
        toValue: 0,
        duration: 300,
        delay: 500,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleLogComplete = () => {
    triggerSuccessAnimation();
    loadData();
  };

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
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={Colors.primary}
        />
      }
    >
      {/* Success animation overlay */}
      <Animated.View
        style={[
          styles.successOverlay,
          {
            opacity: successAnimation,
            transform: [{ scale: successAnimation }],
          },
        ]}
        pointerEvents="none"
      >
        <MaterialCommunityIcons name="check-circle" size={80} color={Colors.primary} />
      </Animated.View>

      {/* SECTION 1 - Custom Header Bar */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>{getGreeting()}, Dad 👋</Text>
          <Text style={styles.riahTitle}>Riah</Text>
        </View>
        <TouchableOpacity style={styles.notificationButton}>
          <MaterialCommunityIcons name="bell" size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* SECTION 2 - Baby Hero Card */}
      <View style={styles.heroCard}>
        <View style={styles.heroLeft}>
          <Text style={styles.heroSubtitle}>Baby is</Text>
          {data.babyInfo ? (
            <Text style={styles.heroAge}>
              {data.babyInfo.age_months} month{data.babyInfo.age_months !== 1 ? 's' : ''} old
            </Text>
          ) : (
            <Text style={styles.heroAge}>--</Text>
          )}
          <Text style={styles.heroDate}>{getTodayDate()}</Text>
          
          <View style={styles.heroStats}>
            <View style={styles.statPill}>
              <Text style={styles.statPillText}>💧 {getTimeAgo(data.diaperTimestamp)}</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statPillText}>🍼 {getTimeAgo(data.feedingTimestamp)}</Text>
            </View>
          </View>
        </View>
        
        <View style={styles.heroRight}>
          <BabyIllustration />
        </View>
      </View>

      {/* SECTION 3 - Quick Log Buttons */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Quick log</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={[styles.quickLogButton, { backgroundColor: '#EBF7FF' }]}
            onPress={() => setDiaperModalVisible(true)}
          >
            <Text style={[styles.quickLogButtonText, { color: '#185FA5' }]}>💧 Diaper</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickLogButton, { backgroundColor: '#FFF0E8' }]}
            onPress={() => setFeedingModalVisible(true)}
          >
            <Text style={[styles.quickLogButtonText, { color: '#854F0B' }]}>🍼 Feed</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickLogButton, { backgroundColor: '#EAF3DE' }]}
            onPress={() => setSleepModalVisible(true)}
          >
            <Text style={[styles.quickLogButtonText, { color: '#3B6D11' }]}>😴 Sleep</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickLogButton, { backgroundColor: '#FAEEDA' }]}
            onPress={() => setStockModalVisible(true)}
          >
            <Text style={[styles.quickLogButtonText, { color: '#854F0B' }]}>📦 Stock</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* SECTION 4 - Status Cards Grid */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Today's summary</Text>
        <View style={styles.cardsGrid}>
          {/* Diaper Card */}
          <View style={[styles.statusCard, { borderLeftColor: '#EBF7FF', borderLeftWidth: 4 }]}>
            <Text style={styles.statusCardValue}>{getTimeAgo(data.diaperTimestamp)}</Text>
            <Text style={styles.statusCardSubtext}>
              {data.lastDiaper ? `${data.lastDiaper.type.charAt(0).toUpperCase() + data.lastDiaper.type.slice(1)} · ${data.todayStats.diapers} changes today` : 'No changes today'}
            </Text>
          </View>

          {/* Feeding Card */}
          <View style={[styles.statusCard, { borderLeftColor: '#FFF0E8', borderLeftWidth: 4 }]}>
            <Text style={styles.statusCardValue}>{getTimeAgo(data.feedingTimestamp)}</Text>
            <Text style={styles.statusCardSubtext}>
              {data.lastFeeding ? `${data.lastFeeding.type.charAt(0).toUpperCase() + data.lastFeeding.type.slice(1)} · ${data.todayStats.feeds} feeds today` : 'No feeds today'}
            </Text>
          </View>

          {/* Sleep Card */}
          <View style={[styles.statusCard, { borderLeftColor: '#EAF3DE', borderLeftWidth: 4 }]}>
            <Text style={styles.statusCardValue}>
              {data.todayStats.sleep > 0 ? formatDuration(data.todayStats.sleep) : '--'}
            </Text>
            <Text style={styles.statusCardSubtext}>
              {data.isCurrentlySleeping ? 'Sleeping now 🌙' : (data.lastSleep ? `Last nap: ${formatTimestampAgo(data.lastSleep.start_time)}` : 'No sleep logged')}
            </Text>
          </View>

          {/* Stock Card */}
          <View style={[styles.statusCard, { borderLeftColor: '#FAEEDA', borderLeftWidth: 4 }]}>
            <Text style={[styles.statusCardValue, { color: data.lowStockCount > 0 ? '#F9C784' : '#A8D5BA' }]}>
              {data.lowStockCount > 0 ? `${data.lowStockCount} items low` : 'All stocked ✓'}
            </Text>
            <Text style={styles.statusCardSubtext}>Diapers · Wipes · Formula</Text>
          </View>
        </View>
      </View>

      {/* SECTION 5 - Upcoming Reminder */}
      {data.upcomingAppointment && (
        <View style={styles.section}>
          <TouchableOpacity
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
                <Text style={styles.appointmentDoctor}>Dr. {data.upcomingAppointment.doctor_name}</Text>
              )}
            </View>
            <View style={styles.appointmentRight}>
              {Math.ceil((data.upcomingAppointment.date - Date.now()) / (1000 * 60 * 60 * 24)) <= 3 && (
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  successOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -40,
    marginTop: -40,
    zIndex: 100,
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
    color: '#8C7B6E',
    fontWeight: '500',
  },
  riahTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#4A3728',
    marginTop: 2,
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF0E8',
    borderWidth: 0.5,
    borderColor: '#F4A98A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Hero card styles
  heroCard: {
    marginHorizontal: Spacing.lg,
    backgroundColor: '#FFF0E8',
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    shadowColor: '#F4A98A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  heroLeft: {
    flex: 0.6,
  },
  heroSubtitle: {
    fontSize: 12,
    color: '#8C7B6E',
    fontWeight: '500',
  },
  heroAge: {
    fontSize: 26,
    fontWeight: '700',
    color: '#4A3728',
    marginTop: 4,
  },
  heroDate: {
    fontSize: 12,
    color: '#8C7B6E',
    marginTop: 4,
  },
  heroStats: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  statPill: {
    backgroundColor: '#FFFAF7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statPillText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#4A3728',
  },
  heroRight: {
    flex: 0.4,
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
    color: '#8C7B6E',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.md,
  },
  // Quick log styles
  quickLogButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    marginRight: 8,
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
    width: '48%',
    backgroundColor: '#FFFAF7',
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
    color: '#4A3728',
    marginBottom: 4,
  },
  statusCardSubtext: {
    fontSize: 12,
    color: '#8C7B6E',
    lineHeight: 16,
  },
  // Appointment card styles
  appointmentCard: {
    backgroundColor: '#EAF3DE',
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
    color: '#4A3728',
    marginBottom: 2,
  },
  appointmentDate: {
    fontSize: 14,
    color: '#3B6D11',
    fontWeight: '500',
    marginBottom: 2,
  },
  appointmentDoctor: {
    fontSize: 12,
    color: '#8C7B6E',
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
