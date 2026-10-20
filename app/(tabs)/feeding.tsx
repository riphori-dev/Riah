import ScreenFeedback from '@/components/ScreenFeedback';
import { useAction } from '@/hooks/useAction';
import { useBreastTimers } from '@/hooks/useBreastTimers';
import { useConfirmDelete } from '@/hooks/useConfirmDelete';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  FlatList,
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing, useTheme, useThemedStyles } from '@/constants';
import { FeedingLog, feedingLogs } from '@/db/database';
import { getTimeAgo } from '@/utils/timeUtils';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type FeedingType = 'breast' | 'bottle' | 'solids';
type BreastSide = 'left' | 'right';
type BottleUnit = 'ml' | 'oz';

const ML_PER_OUNCE = 29.5735;

interface ToastMessage {
  id: string;
  text: string;
  visible: boolean;
}

export default function FeedingScreen() {
  const { colors: Colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const mutation = useAction();
  const deletion = useConfirmDelete();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<FeedingType>('breast');
  const [history, setHistory] = useState<FeedingLog[]>([]);
  const [totalMlToday, setTotalMlToday] = useState(0);
  const [feedCountToday, setFeedCountToday] = useState(0);
  const [lastFeedTimestamp, setLastFeedTimestamp] = useState<string | null>(null); // Raw ISO timestamp
  const [, setTimerTick] = useState(0);

  // Breast feeding state
  const {
    sessionId,
    breastTimers,
    ready: timerReady,
    error: timerError,
    toggleBreastTimer,
    resetAll,
  } = useBreastTimers();
  const [lastBreastSide, setLastBreastSide] = useState<BreastSide | null>(null);

  // Bottle state
  const [bottleAmount, setBottleAmount] = useState(0);
  const [bottleUnit, setBottleUnit] = useState<BottleUnit>('ml');
  const [bottleMilkType, setBottleMilkType] = useState<'formula' | 'breast milk'>('formula');

  // Solids state
  const [solidsFood, setSolidsFood] = useState('');
  const [solidsAmount, setSolidsAmount] = useState('');
  const [solidsNotes, setSolidsNotes] = useState('');

  // UI state
  const [toast, setToast] = useState<ToastMessage>({ id: '', text: '', visible: false });
  const toastAnim = useRef(new Animated.Value(-100)).current;

  const scrollViewRef = useRef<ScrollView>(null);

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const logs = await feedingLogs.getRecent(15);
      setHistory(logs);

      const stats = await feedingLogs.getTodayStats();
      const lastFeed = logs[0];
      setTotalMlToday(stats.amount);
      setFeedCountToday(stats.total);

      // Store raw timestamp for fresh calculation on every render
      if (lastFeed) {
        setLastFeedTimestamp(new Date(lastFeed.timestamp).toISOString());
      } else {
        setLastFeedTimestamp(null);
      }
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : 'Unable to load your records. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

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

  // Update timer every minute (just trigger re-render)
  useEffect(() => {
    const interval = setInterval(() => {
      setTimerTick((prev) => prev + 1);
    }, 60000);

    return () => clearInterval(interval);
  }, []);

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

    const dateStr = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const todayStr = today.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const yesterdayStr = yesterday.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const timeStr = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const timestamp = Date.now();
    let duration = null;
    let amount = null;

    if (activeTab === 'breast') {
      const totalDuration = breastTimers.left.duration + breastTimers.right.duration;
      if (totalDuration === 0) {
        throw new Error('Please start a timer.');
      }
      duration = Math.max(1, Math.round(totalDuration / 60));
    } else if (activeTab === 'bottle') {
      if (!Number.isFinite(bottleAmount) || bottleAmount <= 0) {
        throw new Error('Please enter an amount.');
      }
      amount = getBottleAmountInMl();
    } else if (activeTab === 'solids') {
      if (!solidsFood.trim()) {
        throw new Error('Please enter a food name.');
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
          ? getBottleNote()
          : '',
      activeTab === 'breast' ? sessionId : null,
    );

    // Reset forms
    if (activeTab === 'breast') {
      await resetAll();
    } else if (activeTab === 'bottle') {
      setBottleAmount(0);
      setBottleUnit('ml');
      setBottleMilkType('formula');
    } else {
      setSolidsFood('');
      setSolidsAmount('');
      setSolidsNotes('');
    }

    showToast('Feeding logged!');
    await loadData();
  };

  // Delete entry
  const handleDelete = async (id: number) => {
    try {
      await feedingLogs.deleteById(id);
      await loadData();
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : 'Unable to save changes. Please try again.',
      );
    }
  };

  const renderRightActions = (id: number) => (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel="Delete this record"
      style={styles.deleteAction}
      onPress={() => deletion.ask(() => handleDelete(id))}
    >
      <Ionicons name="trash-outline" size={20} color="white" />
    </TouchableOpacity>
  );

  const getTypeInfo = (
    type: FeedingType,
  ): {
    icon: keyof typeof Ionicons.glyphMap;
    bgColor: string;
    color: string;
  } => {
    switch (type) {
      case 'breast':
        return {
          icon: 'heart',
          bgColor: Colors.softPrimary,
          color: '#F4A98A',
        };
      case 'bottle':
        return {
          icon: 'water',
          bgColor: Colors.softBlue,
          color: '#5BA8D4',
        };
      case 'solids':
        return {
          icon: 'leaf',
          bgColor: Colors.softGreen,
          color: Colors.successText,
        };
    }
  };

  const switchTab = (newTab: FeedingType) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(newTab);
  };

  const getBottleAmountInMl = (): number => {
    if (bottleUnit === 'oz') {
      return Math.round(bottleAmount * ML_PER_OUNCE);
    }

    return bottleAmount;
  };

  const getBottleNote = (): string => {
    return bottleUnit === 'oz' ? `${bottleMilkType} · ${bottleAmount} oz` : bottleMilkType;
  };

  const getBottleDisplayAmount = (item: FeedingLog): string => {
    const ozMatch = item.notes?.match(/·\s*([\d.]+)\s*oz/i);
    if (ozMatch) {
      return `${ozMatch[1]}oz`;
    }

    return `${item.amount_ml}ml`;
  };

  const getBottleDisplayNote = (item: FeedingLog): string => {
    return item.notes?.replace(/\s*·\s*[\d.]+\s*oz/i, '') || 'Formula';
  };

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <ScreenFeedback
          loading={loading}
          error={loadError || mutation.error || timerError}
          onRetry={loadError ? () => loadData() : undefined}
        />

        <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
          <Text style={styles.headerTitle}>Feeding Tracker</Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="View recent feedings"
            style={styles.historyButton}
            onPress={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            <Ionicons name="time-outline" size={22} color={Colors.primary} />
          </TouchableOpacity>
        </View>

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

        <View style={[styles.tabBar, { backgroundColor: Colors.card }]}>
          {(['breast', 'bottle', 'solids'] as const).map((tab) => {
            const isActive = activeTab === tab;
            const tabLabels = { breast: 'Breast', bottle: 'Bottle', solids: 'Solids' };
            const tabIcons: Record<FeedingType, keyof typeof Ionicons.glyphMap> = {
              breast: 'heart-outline',
              bottle: 'water-outline',
              solids: 'leaf-outline',
            };
            const tabColors = {
              breast: { active: '#F4A98A', bg: Colors.softPrimary, border: '#F4A98A' },
              bottle: { active: Colors.infoText, bg: Colors.softBlue, border: Colors.infoText },
              solids: {
                active: Colors.successText,
                bg: Colors.softGreen,
                border: Colors.successText,
              },
            };

            return (
              <TouchableOpacity
                accessibilityRole="button"
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
                <Text
                  style={[styles.tabLabel, { color: isActive ? tabColors[tab].active : '#C4B5A8' }]}
                >
                  {tabLabels[tab]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.contentContainer}>
          {activeTab === 'breast' && (
            <View>
              <View style={[styles.breastCard, { backgroundColor: Colors.card }]}>
                <View style={styles.breastHeader}>
                  <Ionicons name="arrow-back-circle-outline" size={24} color={Colors.primary} />
                  <Text style={styles.breastSideLabel}>Left</Text>
                </View>
                <Text style={styles.timerDisplay}>
                  {formatDuration(breastTimers.left.duration)}
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={[
                    styles.timerToggleButton,
                    {
                      backgroundColor: breastTimers.left.running
                        ? Colors.softDanger
                        : Colors.primary,
                    },
                  ]}
                  accessibilityLabel={
                    breastTimers.left.running
                      ? 'Pause left feeding timer'
                      : 'Start left feeding timer'
                  }
                  disabled={!timerReady}
                  onPress={() =>
                    mutation.run(async () => {
                      await toggleBreastTimer('left');
                      setLastBreastSide('left');
                    })
                  }
                >
                  <Ionicons
                    name={breastTimers.left.running ? 'stop' : 'play'}
                    size={14}
                    color={breastTimers.left.running ? Colors.dangerText : 'white'}
                  />
                  <Text
                    style={[
                      styles.timerButtonText,
                      { color: breastTimers.left.running ? Colors.dangerText : Colors.onPrimary },
                    ]}
                  >
                    {breastTimers.left.running ? 'Stop' : 'Start'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.breastCard, { backgroundColor: Colors.card }]}>
                <View style={styles.breastHeader}>
                  <Ionicons name="arrow-forward-circle-outline" size={24} color="#5BA8D4" />
                  <Text style={styles.breastSideLabel}>Right</Text>
                </View>
                <Text style={styles.timerDisplay}>
                  {formatDuration(breastTimers.right.duration)}
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={[
                    styles.timerToggleButton,
                    {
                      backgroundColor: breastTimers.right.running
                        ? Colors.softDanger
                        : Colors.infoText,
                    },
                  ]}
                  accessibilityLabel={
                    breastTimers.right.running
                      ? 'Pause right feeding timer'
                      : 'Start right feeding timer'
                  }
                  disabled={!timerReady}
                  onPress={() =>
                    mutation.run(async () => {
                      await toggleBreastTimer('right');
                      setLastBreastSide('right');
                    })
                  }
                >
                  <Ionicons
                    name={breastTimers.right.running ? 'stop' : 'play'}
                    size={14}
                    color={breastTimers.right.running ? Colors.dangerText : 'white'}
                  />
                  <Text
                    style={[
                      styles.timerButtonText,
                      { color: breastTimers.right.running ? Colors.dangerText : 'white' },
                    ]}
                  >
                    {breastTimers.right.running ? 'Stop' : 'Start'}
                  </Text>
                </TouchableOpacity>
              </View>

              {lastBreastSide && (
                <Text style={styles.lastSideText}>
                  Last side: {lastBreastSide === 'left' ? 'Left' : 'Right'}
                </Text>
              )}

              <TouchableOpacity
                accessibilityRole="button"
                style={[styles.saveButton, { backgroundColor: Colors.primary }]}
                disabled={mutation.pending}
                accessibilityState={{ busy: mutation.pending }}
                onPress={() => mutation.run(handleSaveFeeding)}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color="white" />
                <Text style={styles.saveButtonText}>
                  {mutation.pending ? 'Saving…' : 'Save feeding'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {activeTab === 'bottle' && (
            <View>
              <View style={[styles.bottleCard, { backgroundColor: Colors.card }]}>
                <Text style={styles.bottleLabel}>Amount</Text>
                <Text style={styles.amountDisplay}>
                  {bottleAmount} {bottleUnit}
                </Text>

                <View style={styles.unitToggleContainer}>
                  {(['ml', 'oz'] as const).map((unit) => (
                    <TouchableOpacity
                      accessibilityRole="button"
                      key={unit}
                      style={[
                        styles.unitTogglePill,
                        bottleUnit === unit && styles.unitTogglePillActive,
                      ]}
                      onPress={() => {
                        setBottleUnit(unit);
                        setBottleAmount(0);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                    >
                      <Text
                        style={[
                          styles.unitToggleText,
                          bottleUnit === unit && styles.unitToggleTextActive,
                        ]}
                      >
                        {unit.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.quickPillsRow}>
                  {(bottleUnit === 'ml' ? [10, 30, 50, 100] : [1, 2, 4, 6]).map((amount) => (
                    <TouchableOpacity
                      accessibilityRole="button"
                      key={amount}
                      style={styles.quickPill}
                      onPress={() => {
                        setBottleAmount((prev) => prev + amount);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                    >
                      <Text style={styles.quickPillText}>
                        +{amount}
                        {bottleUnit}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TextInput
                  style={[styles.manualInput, { borderColor: Colors.primary }]}
                  accessibilityLabel={`Bottle amount in ${bottleUnit}`}
                  placeholder="Or type amount manually"
                  placeholderTextColor={Colors.lightText}
                  keyboardType="decimal-pad"
                  value={bottleAmount > 0 ? bottleAmount.toString() : ''}
                  onChangeText={(text) => setBottleAmount(parseFloat(text) || 0)}
                />

                <Text style={styles.bottleTypeLabel}>Milk type</Text>
                <View style={styles.milkTypeRow}>
                  <TouchableOpacity
                    accessibilityRole="button"
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
                    accessibilityRole="button"
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
                accessibilityRole="button"
                style={[styles.saveButton, { backgroundColor: Colors.primary }]}
                disabled={mutation.pending}
                accessibilityState={{ busy: mutation.pending }}
                onPress={() => mutation.run(handleSaveFeeding)}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color="white" />
                <Text style={styles.saveButtonText}>
                  {mutation.pending ? 'Saving…' : 'Save feeding'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {activeTab === 'solids' && (
            <View>
              <View style={[styles.solidsCard, { backgroundColor: Colors.card }]}>
                <Text style={styles.inputLabel}>Food name</Text>
                <TextInput
                  accessibilityLabel="Food name"
                  style={[styles.textInput, { borderColor: Colors.primary }]}
                  placeholder="e.g. Mashed banana"
                  placeholderTextColor={Colors.lightText}
                  value={solidsFood}
                  onChangeText={setSolidsFood}
                />

                <Text style={styles.inputLabel}>Amount</Text>
                <TextInput
                  accessibilityLabel="Food amount"
                  style={[styles.textInput, { borderColor: Colors.primary }]}
                  placeholder="e.g. 3 tablespoons"
                  placeholderTextColor={Colors.lightText}
                  value={solidsAmount}
                  onChangeText={setSolidsAmount}
                />

                <Text style={styles.inputLabel}>Notes</Text>
                <TextInput
                  accessibilityLabel="Feeding notes"
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
                accessibilityRole="button"
                style={[styles.saveButton, { backgroundColor: Colors.primary }]}
                disabled={mutation.pending}
                accessibilityState={{ busy: mutation.pending }}
                onPress={() => mutation.run(handleSaveFeeding)}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color="white" />
                <Text style={styles.saveButtonText}>
                  {mutation.pending ? 'Saving…' : 'Save feeding'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.historySection}>
          <Text style={styles.sectionLabel}>Recent feedings</Text>

          {history.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="restaurant-outline"
                size={64}
                color={Colors.primary}
                style={{ opacity: 0.4 }}
              />
              <Text style={styles.emptyStateTitle}>No feedings logged yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Use the tabs above to log your first feeding
              </Text>
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
                          <Text style={styles.historyDetails}>{item.duration_minutes}m total</Text>
                        )}
                        {item.type === 'bottle' && item.amount_ml && (
                          <Text style={styles.historyDetails}>
                            {getBottleDisplayAmount(item)} · {getBottleDisplayNote(item)}
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
                              ? getBottleDisplayAmount(item)
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
      {deletion.dialog}
    </View>
  );
}

const createStyles = (Colors: typeof import('@/constants').Colors) =>
  StyleSheet.create({
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
      backgroundColor: Colors.softPrimary,
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
      color: Colors.lightText,
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
      color: Colors.lightText,
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
    unitToggleContainer: {
      flexDirection: 'row',
      backgroundColor: Colors.softBlue,
      borderRadius: 16,
      padding: 4,
      marginBottom: Spacing.lg,
      borderWidth: 1,
      borderColor: '#D7ECFA',
    },
    unitTogglePill: {
      flex: 1,
      borderRadius: 12,
      paddingHorizontal: Spacing.md,
      paddingVertical: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    unitTogglePillActive: {
      backgroundColor: Colors.infoText,
      shadowColor: Colors.infoText,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.14,
      shadowRadius: 6,
      elevation: 2,
    },
    unitToggleText: {
      fontSize: 13,
      fontWeight: '700',
      color: Colors.infoText,
    },
    unitToggleTextActive: {
      color: 'white',
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
      backgroundColor: Colors.softPrimary,
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
      backgroundColor: Colors.softPrimary,
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
      color: Colors.onPrimary,
    },
    historySection: {
      paddingHorizontal: Spacing.lg,
    },
    sectionLabel: {
      fontSize: 11,
      color: Colors.lightText,
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
      color: Colors.lightText,
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
      color: Colors.lightText,
      marginTop: Spacing.xs,
    },
    historyDetails: {
      fontSize: 11,
      color: Colors.lightText,
      marginTop: Spacing.xs,
    },
    amountPill: {
      backgroundColor: Colors.softPrimary,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    amountPillText: {
      fontSize: 11,
      color: Colors.lightText,
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
      backgroundColor: Colors.successText,
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
