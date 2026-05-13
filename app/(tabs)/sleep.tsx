import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  FlatList,
  UIManager,
  Platform,
  AppState,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

import { Colors, Spacing } from '@/constants';
import { sleepLogs, SleepLog } from '@/db/database';
import { getTimeAgo } from '@/utils/timeUtils';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type SleepType = 'nap' | 'night';

interface ToastMessage {
  id: string;
  text: string;
  visible: boolean;
}

interface SleepBlock {
  type: 'sleep' | 'awake';
  duration: number;
  startTime: number;
}

const { width } = Dimensions.get('window');

export default function SleepScreen() {
  const insets = useSafeAreaInsets();
  const [isSleeping, setIsSleeping] = useState(false);
  const [sleepType, setSleepType] = useState<SleepType>('nap');
  const [sleepStartTime, setSleepStartTime] = useState<number | null>(null);
  const [currentSleepDuration, setCurrentSleepDuration] = useState(0);
  const [history, setHistory] = useState<SleepLog[]>([]);
  const [totalSleepToday, setTotalSleepToday] = useState(0);
  const [napCountToday, setNapCountToday] = useState(0);
  const [lastSleepTimestamp, setLastSleepTimestamp] = useState<string | null>(null); // Raw ISO timestamp
  const [timerTick, setTimerTick] = useState(0); // Force re-render on timer update
  const [sleepBlocks, setSleepBlocks] = useState<SleepBlock[]>([]);
  const [toast, setToast] = useState<ToastMessage>({ id: '', text: '', visible: false });

  // Animations
  const pulseAnimation = useRef(new Animated.Value(1)).current;
  const rotationAnimation = useRef(new Animated.Value(0)).current;
  const starAnimations = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];
  const cardBgAnimation = useRef(new Animated.Value(0)).current;
  const toastAnim = useRef(new Animated.Value(-100)).current;
  
  const sleepTimerInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const statsTimerInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  // Initialize sleep state from AsyncStorage
  useEffect(() => {
    const initializeSleepState = async () => {
      try {
        const savedIsSleeping = await AsyncStorage.getItem('isSleeping');
        const savedSleepStartTime = await AsyncStorage.getItem('sleepStartTime');
        const savedSleepType = await AsyncStorage.getItem('sleepType');
        
        if (savedIsSleeping === 'true' && savedSleepStartTime) {
          setIsSleeping(true);
          setSleepStartTime(parseInt(savedSleepStartTime));
          setSleepType((savedSleepType as SleepType) || 'nap');
        }
      } catch (error) {
        console.error('Error loading sleep state:', error);
      }
    };
    
    initializeSleepState();
  }, []);

  // Save sleep state to AsyncStorage
  useEffect(() => {
    const saveSleepState = async () => {
      try {
        await AsyncStorage.setItem('isSleeping', isSleeping.toString());
        if (sleepStartTime) {
          await AsyncStorage.setItem('sleepStartTime', sleepStartTime.toString());
        }
        await AsyncStorage.setItem('sleepType', sleepType);
      } catch (error) {
        console.error('Error saving sleep state:', error);
      }
    };
    
    saveSleepState();
  }, [isSleeping, sleepStartTime, sleepType]);

  // Card background animation
  useEffect(() => {
    Animated.timing(cardBgAnimation, {
      toValue: isSleeping ? 1 : 0,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [isSleeping]);

  // Sun rotation animation (when awake)
  useEffect(() => {
    if (!isSleeping) {
      Animated.loop(
        Animated.timing(rotationAnimation, {
          toValue: 1,
          duration: 8000,
          useNativeDriver: true,
        })
      ).start();
    } else {
      rotationAnimation.stopAnimation();
    }
  }, [isSleeping]);

  // Moon pulse animation (when sleeping)
  useEffect(() => {
    if (isSleeping) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnimation, {
            toValue: 1.06,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnimation, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();
      
      // Star animations
      starAnimations.forEach((anim, index) => {
        Animated.loop(
          Animated.sequence([
            Animated.delay(index * 500),
            Animated.timing(anim, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: 1000,
              useNativeDriver: true,
            }),
          ])
        ).start();
      });
    } else {
      pulseAnimation.setValue(1);
      starAnimations.forEach(anim => anim.setValue(0));
    }
  }, [isSleeping]);

  // Sleep timer
  useEffect(() => {
    if (isSleeping && sleepStartTime) {
      sleepTimerInterval.current = setInterval(() => {
        setCurrentSleepDuration(Math.floor((Date.now() - sleepStartTime) / 1000));
      }, 1000);
    } else {
      if (sleepTimerInterval.current) {
        clearInterval(sleepTimerInterval.current);
      }
    }

    return () => {
      if (sleepTimerInterval.current) {
        clearInterval(sleepTimerInterval.current);
      }
    };
  }, [isSleeping, sleepStartTime]);

  // Load data
  const loadData = useCallback(async () => {
    try {
      const logs = await sleepLogs.getRecent(15);
      setHistory(logs);

      // Calculate today's stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayMs = today.getTime();

      let totalMinutes = 0;
      let napCount = 0;
      let lastSleep = logs[0];
      const blocks: SleepBlock[] = [];

      const allLogs = await sleepLogs.getAll();
      const todayLogs = allLogs.filter((log) => log.start_time >= todayMs);

      // Create timeline blocks
      const todayEnd = todayMs + 24 * 60 * 60 * 1000;
      let currentTime = todayMs;

      todayLogs.sort((a, b) => a.start_time - b.start_time);

      todayLogs.forEach((log) => {
        totalMinutes += log.duration_minutes;
        if (log.type === 'nap') {
          napCount++;
        }

        // Add awake block before sleep
        if (currentTime < log.start_time) {
          blocks.push({
            type: 'awake',
            duration: log.start_time - currentTime,
            startTime: currentTime,
          });
        }

        // Add sleep block
        blocks.push({
          type: 'sleep',
          duration: log.duration_minutes * 60 * 1000,
          startTime: log.start_time,
        });

        currentTime = log.end_time;
      });

      // Add final awake block if needed
      if (currentTime < todayEnd) {
        blocks.push({
          type: 'awake',
          duration: todayEnd - currentTime,
          startTime: currentTime,
        });
      }

      setSleepBlocks(blocks);
      setTotalSleepToday(totalMinutes);
      setNapCountToday(napCount);
      
      // Store raw timestamp for fresh calculation on every render
      if (lastSleep) {
        setLastSleepTimestamp(new Date(lastSleep.start_time).toISOString());
      } else {
        setLastSleepTimestamp(null);
      }
    } catch (error) {
      console.error('Error loading sleep data:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

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

  // Update timer every minute (just trigger re-render)
  useEffect(() => {
    const interval = setInterval(() => {
      setTimerTick(prev => prev + 1);
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    return `${minutes}m ${secs}s`;
  };

  const formatTimeRange = (startTime: number, endTime: number): string => {
    const start = new Date(startTime);
    const end = new Date(endTime);

    return `${start.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })} – ${end.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })}`;
  };

  const formatHistoryTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const dateStr = date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const todayStr = today.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const yesterdayStr = yesterday.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });

    const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    if (dateStr === todayStr) {
      return `Today at ${timeStr}`;
    } else if (dateStr === yesterdayStr) {
      return `Yesterday at ${timeStr}`;
    } else {
      return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${timeStr}`;
    }
  };

  const showToast = (message: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const id = Date.now().toString();
    setToast({ id, text: message, visible: true });

    Animated.sequence([
      Animated.timing(toastAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(2000),
      Animated.timing(toastAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setToast({ id: '', text: '', visible: false });
    });
  };

  const scrollToHistory = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  // Toggle sleep
  const handleToggleSleep = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (isSleeping && sleepStartTime) {
      // Stop sleeping - save to database
      try {
        const endTime = Date.now();
        const durationMinutes = Math.round((endTime - sleepStartTime) / 60000);

        await sleepLogs.insert(sleepStartTime, endTime, durationMinutes, sleepType);

        setIsSleeping(false);
        setSleepStartTime(null);
        setCurrentSleepDuration(0);

        showToast('Sleep logged! 🌟');
        await loadData();
      } catch (error) {
        console.error('Error saving sleep log:', error);
        showToast('Error saving sleep');
      }
    } else {
      // Start sleeping
      const startTime = Date.now();
      setIsSleeping(true);
      setSleepStartTime(startTime);
      setCurrentSleepDuration(0);
    }
  };


  // Delete entry
  const handleDelete = async (id: number) => {
    try {
      await sleepLogs.deleteById(id);
      await loadData();
    } catch (error) {
      console.error('Error deleting sleep log:', error);
    }
  };

  const renderRightActions = (id: number) => (
    <TouchableOpacity style={styles.deleteAction} onPress={() => handleDelete(id)}>
      <Ionicons name="trash-outline" size={20} color="white" />
    </TouchableOpacity>
  );

  const getTypeInfo = (type: SleepType) => {
    switch (type) {
      case 'nap':
        return {
          icon: 'partly-sunny' as const,
          bgColor: '#EAF3DE',
          color: '#3B6D11',
        };
      case 'night':
        return {
          icon: 'moon' as const,
          bgColor: '#F0EFFF',
          color: '#7B68EE',
        };
    }
  };

  const renderHistoryItem = ({ item }: { item: SleepLog }) => {
    const typeInfo = getTypeInfo(item.type);
    return (
      <Swipeable renderRightActions={() => renderRightActions(item.id)}>
        <View style={[styles.historyCard, { backgroundColor: Colors.card }]}>
          <View style={[styles.historyTypeIcon, { backgroundColor: typeInfo.bgColor }]}>
            <Ionicons name={typeInfo.icon} size={22} color={typeInfo.color} />
          </View>

          <View style={styles.historyInfo}>
            <Text style={styles.historyType}>
              {item.type === 'nap' ? 'Nap' : 'Night Sleep'}
            </Text>
            <Text style={styles.historyTime}>{formatTimeRange(item.start_time, item.end_time)}</Text>
            <Text style={styles.historyDate}>{formatHistoryTime(item.start_time)}</Text>
          </View>

          <View style={styles.durationPill}>
            <Text style={styles.durationPillText}>
              {formatDuration(item.duration_minutes * 60)}
            </Text>
          </View>
        </View>
      </Swipeable>
    );
  };

  const cardBackgroundColor = cardBgAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['#FFF0E8', '#EEF0FF'],
  });

  const sunRotation = rotationAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Calculate visual block widths
  const totalBlockDuration = sleepBlocks.reduce((sum, block) => sum + block.duration, 0);
  const blockWidth = totalBlockDuration > 0 ? (width - Spacing.lg * 2) / (totalBlockDuration / (60 * 1000)) : 0;

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
          <Text style={styles.headerTitle}>Sleep Tracker</Text>
          <TouchableOpacity style={styles.historyButton} onPress={scrollToHistory}>
            <Ionicons name="time-outline" size={22} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Daily Summary Bar */}
        <View style={styles.summaryBar}>
          <View style={[styles.summaryCard, { backgroundColor: Colors.card }]}>
            <Ionicons name="moon-outline" size={18} color="#7B68EE" />
            <Text style={styles.summaryNumber}>
              {totalSleepToday > 0 ? `${Math.floor(totalSleepToday / 60)}h ${totalSleepToday % 60}m` : '--'}
            </Text>
            <Text style={styles.summaryLabel}>total sleep</Text>
          </View>

          <View style={[styles.summaryCard, { backgroundColor: Colors.card }]}>
            <Ionicons name="bed-outline" size={18} color="#A8D5BA" />
            <Text style={styles.summaryNumber}>{napCountToday}</Text>
            <Text style={styles.summaryLabel}>naps today</Text>
          </View>

          <View style={[styles.summaryCard, { backgroundColor: Colors.card }]}>
            <Ionicons name="time-outline" size={18} color="#F9C784" />
            <Text style={styles.summaryNumber}>{getTimeAgo(lastSleepTimestamp)}</Text>
            <Text style={styles.summaryLabel}>last sleep</Text>
          </View>
        </View>

        {/* Today's Sleep Timeline */}
        {sleepBlocks.length > 0 && (
          <View style={styles.timelineContainer}>
            <Text style={styles.sectionLabel}>Today's timeline</Text>
            <View style={styles.timelineBar}>
              {sleepBlocks.map((block, idx) => {
                if (block.type === 'sleep') {
                  const startPercent = ((block.startTime - new Date().setHours(0, 0, 0, 0)) / (24 * 60 * 60 * 1000)) * 100;
                  const widthPercent = (block.duration / (24 * 60 * 60 * 1000)) * 100;
                  const log = history.find(log => log.start_time === block.startTime);
                  const isNap = log?.type === 'nap';
                  
                  return (
                    <View
                      key={idx}
                      style={[
                        styles.timelineBlock,
                        {
                          backgroundColor: isNap ? '#A8D5BA' : '#7B68EE',
                          left: `${startPercent}%`,
                          width: `${widthPercent}%`,
                        },
                      ]}
                    />
                  );
                }
                return null;
              })}
            </View>
            <View style={styles.timelineMarkers}>
              <Text style={styles.timelineMarker}>12am</Text>
              <Text style={styles.timelineMarker}>6am</Text>
              <Text style={styles.timelineMarker}>12pm</Text>
              <Text style={styles.timelineMarker}>6pm</Text>
              <Text style={styles.timelineMarker}>12am</Text>
            </View>
          </View>
        )}

        {/* Hero Sleep Toggle Card */}
        <Animated.View style={[styles.heroCard, { backgroundColor: cardBackgroundColor }]}>
          {/* Animated Icon */}
          {!isSleeping ? (
            <Animated.View
              style={[
                styles.iconCircle,
                styles.sunCircle,
                { transform: [{ rotate: sunRotation }] },
              ]}
            >
              <Ionicons name="sunny-outline" size={52} color="#F9C784" />
            </Animated.View>
          ) : (
            <View style={styles.moonContainer}>
              <Animated.View style={[styles.iconCircle, styles.moonCircle, { transform: [{ scale: pulseAnimation }] }]}>
                <Ionicons name="moon" size={52} color="#7B68EE" />
              </Animated.View>
              {starAnimations.map((anim, index) => (
                <Animated.View
                  key={index}
                  style={[
                    styles.star,
                    {
                      opacity: anim,
                      transform: [
                        {
                          translateX: Math.cos((index * 120) * Math.PI / 180) * 60,
                        },
                        {
                          translateY: Math.sin((index * 120) * Math.PI / 180) * 60,
                        },
                      ],
                    },
                  ]}
                >
                  <Ionicons name="star" size={8} color="#7B68EE" />
                </Animated.View>
              ))}
            </View>
          )}

          {/* Status Text */}
          {!isSleeping ? (
            <View style={styles.statusTextContainer}>
              <Text style={styles.statusText}>Baby is awake</Text>
              <Text style={styles.statusSubtext}>Tap to start sleep timer</Text>
            </View>
          ) : (
            <View style={styles.statusTextContainer}>
              <Text style={styles.statusText}>Baby is sleeping</Text>
              <Text style={styles.sleepDuration}>{formatDuration(currentSleepDuration)}</Text>
              <Text style={styles.statusSubtext}>
                Started at {new Date(sleepStartTime!).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </Text>
            </View>
          )}

          {/* Sleep Type Selector (only when awake) */}
          {!isSleeping && (
            <View style={styles.sleepTypeSelector}>
              <TouchableOpacity
                style={[
                  styles.sleepTypePill,
                  sleepType === 'nap' && styles.sleepTypePillActive,
                ]}
                onPress={() => setSleepType('nap')}
              >
                <Ionicons name="partly-sunny-outline" size={14} color={sleepType === 'nap' ? 'white' : '#8C7B6E'} />
                <Text style={[styles.sleepTypeText, { color: sleepType === 'nap' ? 'white' : '#8C7B6E' }]}>
                  Nap
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.sleepTypePill,
                  sleepType === 'night' && styles.sleepTypePillActive,
                ]}
                onPress={() => setSleepType('night')}
              >
                <Ionicons name="moon-outline" size={14} color={sleepType === 'night' ? 'white' : '#8C7B6E'} />
                <Text style={[styles.sleepTypeText, { color: sleepType === 'night' ? 'white' : '#8C7B6E' }]}>
                  Night sleep
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Action Button */}
          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: isSleeping ? '#F4A98A' : '#7B68EE',
                padding: Spacing.md,
               },
            ]}
            onPress={handleToggleSleep}
          >
            <Ionicons name={isSleeping ? 'sunny-outline' : 'play-circle-outline'} size={22} color="white" />
            <Text style={styles.actionButtonText}>
              {isSleeping ? 'Wake Up' : 'Start Sleep'}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* History List */}
        <View style={styles.historySection}>
          <Text style={styles.sectionLabel}>Recent sleep sessions</Text>
          {history.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="moon-outline" size={64} color="#7B68EE" style={{ opacity: 0.4 }} />
              <Text style={styles.emptyStateTitle}>No sleep logged yet</Text>
              <Text style={styles.emptyStateSubtext}>Tap Start Sleep above to begin tracking</Text>
            </View>
          ) : (
            <FlatList
              data={history}
              renderItem={renderHistoryItem}
              keyExtractor={(item) => item.id.toString()}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
            />
          )}
        </View>
      </ScrollView>

      {/* Toast */}
      {toast.visible && (
        <Animated.View
          style={[
            styles.toast,
            {
              transform: [{ translateY: toastAnim }],
            },
          ]}
        >
          <Ionicons name="checkmark-circle" size={16} color="white" />
          <Text style={styles.toastText}>{toast.text}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
  },
  historyButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF0E8',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: Colors.primary,
  },
  summaryBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  summaryCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: 16,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginTop: Spacing.sm,
  },
  summaryLabel: {
    fontSize: 11,
    color: '#8C7B6E',
    fontWeight: '600',
    marginTop: Spacing.xs,
  },
  sectionLabel: {
    fontSize: 11,
    color: '#8C7B6E',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  timelineContainer: {
    marginBottom: Spacing.xl,
  },
  timelineBar: {
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0EFFF',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  timelineBlock: {
    position: 'absolute',
    height: '100%',
    borderRadius: 8,
  },
  timelineMarkers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
  },
  timelineMarker: {
    fontSize: 10,
    color: '#8C7B6E',
    fontWeight: '500',
  },
  heroCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
    borderRadius: 24,
    padding: Spacing.xl,
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  sunCircle: {
    backgroundColor: '#FFF8E8',
  },
  moonCircle: {
    backgroundColor: '#E8E8FF',
  },
  moonContainer: {
    position: 'relative',
    marginBottom: Spacing.lg,
  },
  star: {
    position: 'absolute',
  },
  statusTextContainer: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  statusText: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  sleepDuration: {
    fontSize: 32,
    fontWeight: '700',
    color: '#7B68EE',
    marginBottom: Spacing.sm,
  },
  statusSubtext: {
    fontSize: 13,
    color: '#8C7B6E',
  },
  sleepTypeSelector: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  sleepTypePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F0EFFF',
    gap: Spacing.sm,
  },
  sleepTypePillActive: {
    backgroundColor: '#7B68EE',
  },
  sleepTypeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 20,
    gap: Spacing.sm,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
  },
  historySection: {
    paddingHorizontal: Spacing.lg,
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderRadius: 16,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: Spacing.sm,
  },
  historyTypeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  historyInfo: {
    flex: 1,
  },
  historyType: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  historyTime: {
    fontSize: 12,
    color: '#8C7B6E',
    marginTop: Spacing.xs,
  },
  historyDate: {
    fontSize: 12,
    color: '#8C7B6E',
    marginTop: Spacing.xs,
  },
  durationPill: {
    backgroundColor: '#F0EFFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  durationPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7B68EE',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginTop: Spacing.lg,
  },
  emptyStateSubtext: {
    fontSize: 13,
    color: '#8C7B6E',
    marginTop: Spacing.sm,
  },
  deleteAction: {
    backgroundColor: '#C0392B',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 16,
    marginLeft: Spacing.sm,
  },
  toast: {
    position: 'absolute',
    bottom: 40,
    left: Spacing.lg,
    right: Spacing.lg,
    backgroundColor: '#7B68EE',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: 999,
    gap: Spacing.md,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  toastText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});
