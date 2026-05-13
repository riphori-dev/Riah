import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  TextInput,
  FlatList,
  LayoutAnimation,
  UIManager,
  Platform,
  AppState,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

import { Colors, Spacing } from '@/constants';
import { feedingLogs, FeedingLog } from '@/db/database';
import { getTimeAgo } from '@/utils/timeUtils';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type FeedingType = 'breast' | 'bottle' | 'solids';
type BreastSide = 'left' | 'right';

interface ToastMessage {
  id: string;
  text: string;
  visible: boolean;
}

export default function FeedingScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<FeedingType>('breast');
  const [history, setHistory] = useState<FeedingLog[]>([]);
  const [totalMlToday, setTotalMlToday] = useState(0);
  const [feedCountToday, setFeedCountToday] = useState(0);
  const [lastFeedTimestamp, setLastFeedTimestamp] = useState<string | null>(null); // Raw ISO timestamp
  const [timerTick, setTimerTick] = useState(0); // Force re-render on timer update

  // Breast feeding state
  const [breastTimers, setBreastTimers] = useState({
    left: { running: false, duration: 0 },
    right: { running: false, duration: 0 },
  });
  const [lastBreastSide, setLastBreastSide] = useState<BreastSide | null>(null);
  const breastTimerIntervals = useRef<{ left?: NodeJS.Timeout; right?: NodeJS.Timeout }>({});

  // Bottle state
  const [bottleAmount, setBottleAmount] = useState(0);
  const [bottleMilkType, setBottleMilkType] = useState<'formula' | 'breast milk'>('formula');

  // Solids state
  const [solidsFood, setSolidsFood] = useState('');
  const [solidsAmount, setSolidsAmount] = useState('');
  const [solidsNotes, setSolidsNotes] = useState('');

  // UI state
  const [toast, setToast] = useState<ToastMessage>({ id: '', text: '', visible: false });
  const [tabFadeAnim] = useState(new Animated.Value(1));
  const toastAnim = useRef(new Animated.Value(-100)).current;
  const statsTimerInterval = useRef<NodeJS.Timeout | null>(null);

  // Load data
  const loadData = useCallback(async () => {
    try {
      const logs = await feedingLogs.getRecent(15);
      setHistory(logs);

      // Calculate today's stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayMs = today.getTime();

      let totalMl = 0;
      let feedCount = 0;
      let lastFeed = logs[0];

      logs.forEach((log) => {
        if (log.timestamp >= todayMs) {
          feedCount++;
          if (log.amount_ml) totalMl += log.amount_ml;
        }
      });

      setTotalMlToday(totalMl);
      setFeedCountToday(feedCount);
      
      // Store raw timestamp for fresh calculation on every render
      if (lastFeed) {
        setLastFeedTimestamp(new Date(lastFeed.timestamp).toISOString());
      } else {
        setLastFeedTimestamp(null);
      }
    } catch (error) {
      console.error('Error loading feeding data:', error);
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

  // Breast timer management
  const toggleBreastTimer = (side: BreastSide) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setBreastTimers((prev) => {
      const newState = { ...prev };
      const sideState = newState[side];

      if (sideState.running) {
        // Stop timer
        if (breastTimerIntervals.current[side]) {
          clearInterval(breastTimerIntervals.current[side]);
          delete breastTimerIntervals.current[side];
        }
        sideState.running = false;
      } else {
        // Start timer
        sideState.running = true;
        setLastBreastSide(side);
        breastTimerIntervals.current[side] = setInterval(() => {
          setBreastTimers((prev) => ({
            ...prev,
            [side]: {
              ...prev[side],
              duration: prev[side].duration + 1,
            },
          }));
        }, 1000);
      }

      return newState;
    });
  };

  const resetBreastTimer = (side: BreastSide) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (breastTimerIntervals.current[side]) {
      clearInterval(breastTimerIntervals.current[side]);
      delete breastTimerIntervals.current[side];
    }
    setBreastTimers((prev) => ({
      ...prev,
      [side]: { running: false, duration: 0 },
    }));
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const secStr = secs < 10 ? `0${secs}` : `${secs}`;
    return `${mins}:${secStr}`;
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

  // Save feeding
  const handleSaveFeeding = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const timestamp = Date.now();
      let duration = null;
      let amount = null;

      if (activeTab === 'breast') {
        const totalDuration = breastTimers.left.duration + breastTimers.right.duration;
        if (totalDuration === 0) {
          showToast('Please start a timer');
          return;
        }
        duration = Math.round(totalDuration / 60);
      } else if (activeTab === 'bottle') {
        if (bottleAmount === 0) {
          showToast('Please enter an amount');
          return;
        }
        amount = bottleAmount;
      } else if (activeTab === 'solids') {
        if (!solidsFood.trim()) {
          showToast('Please enter a food name');
          return;
        }
      }

      await feedingLogs.insert(
        timestamp,
        activeTab,
        amount,
        duration,
        activeTab === 'solids'
          ? `${solidsFood}${solidsAmount ? ', ' + solidsAmount : ''}${solidsNotes ? '. ' + solidsNotes : ''}`
          : activeTab === 'bottle'
            ? `${bottleMilkType}`
            : ''
      );

      // Reset forms
      if (activeTab === 'breast') {
        resetBreastTimer('left');
        resetBreastTimer('right');
      } else if (activeTab === 'bottle') {
        setBottleAmount(0);
        setBottleMilkType('formula');
      } else {
        setSolidsFood('');
        setSolidsAmount('');
        setSolidsNotes('');
      }

      showToast('Feeding logged!');
      await loadData();
    } catch (error) {
      console.error('Error saving feeding:', error);
      showToast('Error saving feeding');
    }
  };

  // Delete entry
  const handleDelete = async (id: number) => {
    try {
      await feedingLogs.deleteById(id);
      await loadData();
    } catch (error) {
      console.error('Error deleting feeding log:', error);
    }
  };

  const renderRightActions = (id: number) => (
    <TouchableOpacity style={styles.deleteAction} onPress={() => handleDelete(id)}>
      <Ionicons name="trash-outline" size={20} color="white" />
    </TouchableOpacity>
  );

  const getTypeInfo = (type: FeedingType) => {
    switch (type) {
      case 'breast':
        return {
          icon: 'heart',
          bgColor: '#FFF0E8',
          color: '#F4A98A',
        };
      case 'bottle':
        return {
          icon: 'water',
          bgColor: '#EBF7FF',
          color: '#5BA8D4',
        };
      case 'solids':
        return {
          icon: 'leaf',
          bgColor: '#EAF3DE',
          color: '#3B6D11',
        };
    }
  };

  const switchTab = (newTab: FeedingType) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(newTab);
  };

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
          <Text style={styles.headerTitle}>Feeding Tracker</Text>
          <TouchableOpacity style={styles.historyButton}>
            <Ionicons name="time-outline" size={22} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Daily Summary Bar */}
        <View style={styles.summaryBar}>
          <View style={[styles.summaryCard, { backgroundColor: Colors.card }]}>
            <Ionicons name="beaker-outline" size={18} color={Colors.primary} />
            <Text style={styles.summaryNumber}>{totalMlToday}ml</Text>
            <Text style={styles.summaryLabel}>total today</Text>
          </View>

          <View style={[styles.summaryCard, { backgroundColor: Colors.card }]}>
            <Ionicons name="repeat-outline" size={18} color={Colors.secondary} />
            <Text style={styles.summaryNumber}>{feedCountToday}</Text>
            <Text style={styles.summaryLabel}>feedings</Text>
          </View>

          <View style={[styles.summaryCard, { backgroundColor: Colors.card }]}>
            <Ionicons name="time-outline" size={18} color="#F9C784" />
            <Text style={styles.summaryNumber}>{getTimeAgo(lastFeedTimestamp)}</Text>
            <Text style={styles.summaryLabel}>last feed</Text>
          </View>
        </View>

        {/* Tab Bar */}
        <View style={[styles.tabBar, { backgroundColor: Colors.card }]}>
          {(['breast', 'bottle', 'solids'] as const).map((tab) => {
            const isActive = activeTab === tab;
            const tabLabels = { breast: 'Breast', bottle: 'Bottle', solids: 'Solids' };
            const tabIcons = { breast: 'heart-outline', bottle: 'water-outline', solids: 'leaf-outline' };
            const tabColors = {
              breast: { active: '#F4A98A', bg: '#FFF0E8', border: '#F4A98A' },
              bottle: { active: '#185FA5', bg: '#EBF7FF', border: '#185FA5' },
              solids: { active: '#3B6D11', bg: '#EAF3DE', border: '#3B6D11' },
            };

            return (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.tabButton,
                  isActive && {
                    backgroundColor: tabColors[tab].bg,
                    borderBottomWidth: 2,
                    borderBottomColor: tabColors[tab].border,
                  },
                ]}
                onPress={() => switchTab(tab)}
              >
                <Ionicons
                  name={tabIcons[tab]}
                  size={20}
                  color={isActive ? tabColors[tab].active : '#C4B5A8'}
                />
                <Text style={[styles.tabLabel, { color: isActive ? tabColors[tab].active : '#C4B5A8' }]}>
                  {tabLabels[tab]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Tab Content */}
        <View style={styles.contentContainer}>
          {activeTab === 'breast' && (
            <View>
              {/* Left Timer */}
              <View style={[styles.breastCard, { backgroundColor: Colors.card }]}>
                <View style={styles.breastHeader}>
                  <Ionicons name="arrow-back-circle-outline" size={24} color={Colors.primary} />
                  <Text style={styles.breastSideLabel}>Left</Text>
                </View>
                <Text style={styles.timerDisplay}>{formatDuration(breastTimers.left.duration)}</Text>
                <TouchableOpacity
                  style={[
                    styles.timerToggleButton,
                    { backgroundColor: breastTimers.left.running ? '#FFE8E8' : Colors.primary },
                  ]}
                  onPress={() => toggleBreastTimer('left')}
                >
                  <Ionicons
                    name={breastTimers.left.running ? 'stop' : 'play'}
                    size={14}
                    color={breastTimers.left.running ? '#C0392B' : 'white'}
                  />
                  <Text style={[styles.timerButtonText, { color: breastTimers.left.running ? '#C0392B' : 'white' }]}>
                    {breastTimers.left.running ? 'Stop' : 'Start'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Right Timer */}
              <View style={[styles.breastCard, { backgroundColor: Colors.card }]}>
                <View style={styles.breastHeader}>
                  <Ionicons name="arrow-forward-circle-outline" size={24} color="#5BA8D4" />
                  <Text style={styles.breastSideLabel}>Right</Text>
                </View>
                <Text style={styles.timerDisplay}>{formatDuration(breastTimers.right.duration)}</Text>
                <TouchableOpacity
                  style={[
                    styles.timerToggleButton,
                    { backgroundColor: breastTimers.right.running ? '#FFE8E8' : '#185FA5' },
                  ]}
                  onPress={() => toggleBreastTimer('right')}
                >
                  <Ionicons
                    name={breastTimers.right.running ? 'stop' : 'play'}
                    size={14}
                    color={breastTimers.right.running ? '#C0392B' : 'white'}
                  />
                  <Text style={[styles.timerButtonText, { color: breastTimers.right.running ? '#C0392B' : 'white' }]}>
                    {breastTimers.right.running ? 'Stop' : 'Start'}
                  </Text>
                </TouchableOpacity>
              </View>

              {lastBreastSide && (
                <Text style={styles.lastSideText}>Last side: {lastBreastSide === 'left' ? 'Left' : 'Right'}</Text>
              )}

              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: Colors.primary }]}
                onPress={handleSaveFeeding}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color="white" />
                <Text style={styles.saveButtonText}>Save Feeding</Text>
              </TouchableOpacity>
            </View>
          )}

          {activeTab === 'bottle' && (
            <View>
              <View style={[styles.bottleCard, { backgroundColor: Colors.card }]}>
                <Text style={styles.bottleLabel}>Amount</Text>
                <Text style={styles.amountDisplay}>{bottleAmount} ml</Text>

                {/* Quick add pills */}
                <View style={styles.quickPillsRow}>
                  {[10, 30, 50, 100].map((amount) => (
                    <TouchableOpacity
                      key={amount}
                      style={styles.quickPill}
                      onPress={() => {
                        setBottleAmount((prev) => prev + amount);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                    >
                      <Text style={styles.quickPillText}>+{amount}ml</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Manual input */}
                <TextInput
                  style={[styles.manualInput, { borderColor: Colors.primary }]}
                  placeholder="Or type amount manually"
                  placeholderTextColor={Colors.lightText}
                  keyboardType="number-pad"
                  value={bottleAmount > 0 ? bottleAmount.toString() : ''}
                  onChangeText={(text) => setBottleAmount(parseInt(text) || 0)}
                />

                {/* Milk type toggle */}
                <Text style={styles.bottleTypeLabel}>Milk type</Text>
                <View style={styles.milkTypeRow}>
                  <TouchableOpacity
                    style={[
                      styles.milkTypePill,
                      bottleMilkType === 'formula' && { backgroundColor: Colors.primary },
                    ]}
                    onPress={() => {
                      setBottleMilkType('formula');
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <Text
                      style={[
                        styles.milkTypeText,
                        { color: bottleMilkType === 'formula' ? 'white' : Colors.lightText },
                      ]}
                    >
                      Formula
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.milkTypePill,
                      bottleMilkType === 'breast milk' && { backgroundColor: Colors.primary },
                    ]}
                    onPress={() => {
                      setBottleMilkType('breast milk');
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <Text
                      style={[
                        styles.milkTypeText,
                        { color: bottleMilkType === 'breast milk' ? 'white' : Colors.lightText },
                      ]}
                    >
                      Breast Milk
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: Colors.primary }]}
                onPress={handleSaveFeeding}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color="white" />
                <Text style={styles.saveButtonText}>Save Feeding</Text>
              </TouchableOpacity>
            </View>
          )}

          {activeTab === 'solids' && (
            <View>
              <View style={[styles.solidsCard, { backgroundColor: Colors.card }]}>
                <Text style={styles.inputLabel}>Food name</Text>
                <TextInput
                  style={[styles.textInput, { borderColor: Colors.primary }]}
                  placeholder="e.g. Mashed banana"
                  placeholderTextColor={Colors.lightText}
                  value={solidsFood}
                  onChangeText={setSolidsFood}
                />

                <Text style={styles.inputLabel}>Amount</Text>
                <TextInput
                  style={[styles.textInput, { borderColor: Colors.primary }]}
                  placeholder="e.g. 3 tablespoons"
                  placeholderTextColor={Colors.lightText}
                  value={solidsAmount}
                  onChangeText={setSolidsAmount}
                />

                <Text style={styles.inputLabel}>Notes</Text>
                <TextInput
                  style={[styles.textInput, { borderColor: Colors.primary, minHeight: 80 }]}
                  placeholder="Any reactions or observations..."
                  placeholderTextColor={Colors.lightText}
                  value={solidsNotes}
                  onChangeText={setSolidsNotes}
                  multiline
                  maxLength={200}
                />
              </View>

              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: Colors.primary }]}
                onPress={handleSaveFeeding}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color="white" />
                <Text style={styles.saveButtonText}>Save Feeding</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* History */}
        <View style={styles.historySection}>
          <Text style={styles.sectionLabel}>Recent feedings</Text>

          {history.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="restaurant-outline" size={64} color={Colors.primary} style={{ opacity: 0.4 }} />
              <Text style={styles.emptyStateTitle}>No feedings logged yet</Text>
              <Text style={styles.emptyStateSubtext}>Use the tabs above to log your first feeding</Text>
            </View>
          ) : (
            <FlatList
              data={history}
              renderItem={({ item }) => {
                const typeInfo = getTypeInfo(item.type);
                return (
                  <Swipeable renderRightActions={() => renderRightActions(item.id)}>
                    <View style={[styles.historyCard, { backgroundColor: Colors.card }]}>
                      <View style={[styles.historyTypeIcon, { backgroundColor: typeInfo.bgColor }]}>
                        <Ionicons name={typeInfo.icon} size={22} color={typeInfo.color} />
                      </View>

                      <View style={styles.historyInfo}>
                        <Text style={styles.historyType}>
                          {item.type === 'breast'
                            ? 'Breast'
                            : item.type === 'bottle'
                              ? 'Bottle'
                              : 'Solids'}
                        </Text>
                        <Text style={styles.historyTime}>{formatHistoryTime(item.timestamp)}</Text>
                        {item.type === 'breast' && item.duration_minutes && (
                          <Text style={styles.historyDetails}>
                            {item.duration_minutes}m total
                          </Text>
                        )}
                        {item.type === 'bottle' && item.amount_ml && (
                          <Text style={styles.historyDetails}>
                            {item.amount_ml}ml · {item.notes || 'Formula'}
                          </Text>
                        )}
                        {item.type === 'solids' && (
                          <Text style={styles.historyDetails}>{item.notes || 'Food logged'}</Text>
                        )}
                      </View>

                      <View style={styles.amountPill}>
                        <Text style={styles.amountPillText}>
                          {item.type === 'breast'
                            ? `${item.duration_minutes}m`
                            : item.type === 'bottle'
                              ? `${item.amount_ml}ml`
                              : ''}
                        </Text>
                      </View>
                    </View>
                  </Swipeable>
                );
              }}
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
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
    borderRadius: 16,
    padding: 4,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: 12,
    gap: Spacing.xs,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  contentContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  breastCard: {
    borderRadius: 20,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  breastHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  breastSideLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  timerDisplay: {
    fontSize: 48,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  timerToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: 12,
    gap: Spacing.sm,
  },
  timerButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  lastSideText: {
    fontSize: 12,
    color: '#8C7B6E',
    marginBottom: Spacing.lg,
  },
  bottleCard: {
    borderRadius: 20,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  bottleLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  amountDisplay: {
    fontSize: 48,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  quickPillsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickPill: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFF0E8',
    borderRadius: 999,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  quickPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  manualInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: Spacing.md,
    fontSize: 14,
    color: Colors.text,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  bottleTypeLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  milkTypeRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  milkTypePill: {
    flex: 1,
    backgroundColor: '#FFF0E8',
    borderRadius: 999,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  milkTypeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  solidsCard: {
    borderRadius: 20,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  textInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: Spacing.md,
    fontSize: 14,
    color: Colors.text,
    marginBottom: Spacing.lg,
    textAlignVertical: 'top',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    borderRadius: 16,
    gap: Spacing.md,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
  },
  historySection: {
    paddingHorizontal: Spacing.lg,
  },
  sectionLabel: {
    fontSize: 11,
    color: '#8C7B6E',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.md,
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
  historyDetails: {
    fontSize: 11,
    color: '#8C7B6E',
    marginTop: Spacing.xs,
  },
  amountPill: {
    backgroundColor: '#FFF0E8',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  amountPillText: {
    fontSize: 11,
    color: '#8C7B6E',
    fontWeight: '600',
  },
  deleteAction: {
    backgroundColor: '#E8542F',
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
    backgroundColor: '#3B6D11',
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
