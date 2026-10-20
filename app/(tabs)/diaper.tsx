import ScreenFeedback from '@/components/ScreenFeedback';
import { useAction } from '@/hooks/useAction';
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
import { DiaperLog, diaperLogs } from '@/db/database';
import { getTimeAgo } from '@/utils/timeUtils';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface HistoryEntry extends DiaperLog {
  timeAgo?: string;
}

interface ToastMessage {
  id: string;
  text: string;
  visible: boolean;
}

export default function DiaperScreen() {
  const { colors: Colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const mutation = useAction();
  const deletion = useConfirmDelete();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { colors, isDarkMode } = useTheme();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [lastChange, setLastChange] = useState<DiaperLog | null>(null);
  const [lastChangeTimestamp, setLastChangeTimestamp] = useState<string | null>(null); // Raw ISO timestamp
  const [, setTimerTick] = useState(0);
  const [timersToday, setTimersToday] = useState({ total: 0, wet: 0, dirty: 0 });
  const [showNotesInput, setShowNotesInput] = useState(false);
  const [pendingType, setPendingType] = useState<'wet' | 'dirty' | 'both' | null>(null);
  const [notes, setNotes] = useState('');
  const [toast, setToast] = useState<ToastMessage>({ id: '', text: '', visible: false });

  const scrollViewRef = useRef<ScrollView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const toastAnim = useRef(new Animated.Value(-100)).current;

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const logs = await diaperLogs.getRecent(15);
      setHistory(logs);
      setLastChange(logs[0] || null);

      // Store raw timestamp for fresh calculation on every render
      if (logs[0]) {
        setLastChangeTimestamp(new Date(logs[0].timestamp).toISOString());
      } else {
        setLastChangeTimestamp(null);
      }

      const stats = await diaperLogs.getTodayStats();
      setTimersToday(stats);
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

  // Pulse animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ]),
    ).start();
  }, [pulseAnim]);

  const getStatusInfo = (): {
    color: string;
    bgColor: string;
    text: string;
    icon: keyof typeof Ionicons.glyphMap;
  } => {
    if (!lastChange) {
      return {
        color: Colors.successText,
        bgColor: Colors.softGreen,
        text: 'No record yet',
        icon: 'checkmark-circle',
      };
    }

    const hours = (Date.now() - lastChange.timestamp) / (1000 * 60 * 60);

    if (hours < 2) {
      return {
        color: Colors.successText,
        bgColor: Colors.softGreen,
        text: 'All good',
        icon: 'checkmark-circle',
      };
    } else if (hours < 3) {
      return {
        color: Colors.warningText,
        bgColor: Colors.softYellow,
        text: 'Check soon',
        icon: 'time-outline',
      };
    } else {
      return {
        color: Colors.dangerText,
        bgColor: Colors.softDanger,
        text: 'Change needed!',
        icon: 'alert-circle',
      };
    }
  };

  const logChange = async (type: 'wet' | 'dirty' | 'both') => {
    if (showNotesInput) {
      // Already showing notes input
      return;
    }

    // Haptic feedback
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setPendingType(type);
    setNotes('');
    setShowNotesInput(true);

    // Trigger layout animation
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  };

  const saveChange = async (skip = false) => {
    if (!pendingType) return;

    try {
      await diaperLogs.insert(Date.now(), pendingType, skip ? '' : notes);

      // Reset state
      setShowNotesInput(false);
      setPendingType(null);
      setNotes('');

      // Show toast
      showToast('Change logged!');

      // Reload data
      await loadData();
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : 'Unable to save changes. Please try again.',
      );
    }
  };

  const skipNote = async () => {
    await saveChange(true);
  };

  const showToast = (message: string) => {
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

  const handleDeleteEntry = async (id: number) => {
    try {
      await diaperLogs.deleteById(id);
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
      onPress={() => deletion.ask(() => handleDeleteEntry(id))}
    >
      <Ionicons name="trash-outline" size={20} color="white" />
    </TouchableOpacity>
  );

  const getTypeIcon = (
    type: 'wet' | 'dirty' | 'both',
  ): {
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    bgColor: string;
  } => {
    switch (type) {
      case 'wet':
        return { icon: 'water', color: '#5BA8D4', bgColor: Colors.softBlue };
      case 'dirty':
        return { icon: 'leaf', color: '#D4845A', bgColor: '#FFF3E0' };
      case 'both':
        return { icon: 'git-merge', color: '#F4A98A', bgColor: Colors.softPrimary };
    }
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

  const status = getStatusInfo();

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <ScreenFeedback
          loading={loading}
          error={loadError || mutation.error}
          onRetry={loadError ? () => loadData() : undefined}
        />

        <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Diaper Tracker</Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="View recent diaper changes"
            onPress={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
            style={[
              styles.historyButton,
              { backgroundColor: isDarkMode ? colors.card : Colors.softPrimary },
            ]}
          >
            <Ionicons name="time-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View
          style={[
            styles.heroCard,
            { backgroundColor: isDarkMode ? colors.card : Colors.softPrimary },
          ]}
        >
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <View
              style={[
                styles.waterDropCircle,
                { backgroundColor: isDarkMode ? colors.background : Colors.softPrimary },
              ]}
            >
              <Ionicons name="water" size={64} color={colors.primary} />
            </View>
          </Animated.View>

          <Text style={[styles.heroLabel, { color: colors.lightText }]}>Last change</Text>
          <Text style={[styles.heroTimer, { color: colors.text }]}>
            {getTimeAgo(lastChangeTimestamp)}
          </Text>

          <View style={[styles.statusPill, { backgroundColor: status.bgColor }]}>
            <Ionicons name={status.icon} size={14} color={status.color} />
            <Text style={[styles.statusText, { color: status.color }]}>{status.text}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.lightText }]}>Log a change</Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              accessibilityRole="button"
              style={[
                styles.logButton,
                { backgroundColor: isDarkMode ? '#173145' : Colors.softBlue },
              ]}
              onPress={() => logChange('wet')}
            >
              <Ionicons name="water-outline" size={32} color="#5BA8D4" />
              <Text style={[styles.logButtonLabel, { color: Colors.infoText }]}>Wet</Text>
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              style={[styles.logButton, { backgroundColor: isDarkMode ? '#3A2D18' : '#FFF3E0' }]}
              onPress={() => logChange('dirty')}
            >
              <Ionicons name="leaf-outline" size={32} color="#D4845A" />
              <Text style={[styles.logButtonLabel, { color: Colors.warningText }]}>Dirty</Text>
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              style={[
                styles.logButton,
                { backgroundColor: isDarkMode ? '#3A2720' : Colors.softPrimary },
              ]}
              onPress={() => logChange('both')}
            >
              <Ionicons name="git-merge-outline" size={32} color={colors.primary} />
              <Text style={[styles.logButtonLabel, { color: colors.text }]}>Both</Text>
            </TouchableOpacity>
          </View>

          {showNotesInput && (
            <View style={styles.notesContainer}>
              <TextInput
                accessibilityLabel="Diaper notes"
                style={[styles.notesInput, { backgroundColor: colors.card, color: colors.text }]}
                placeholder="Add a note (optional)"
                placeholderTextColor={Colors.lightText}
                value={notes}
                onChangeText={setNotes}
                maxLength={100}
                multiline
              />
              <View style={styles.notesButtons}>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={[styles.noteButton, { backgroundColor: Colors.primary }]}
                  disabled={mutation.pending}
                  onPress={() => mutation.run(() => saveChange())}
                >
                  <Ionicons name="checkmark-circle" size={16} color="white" />
                  <Text style={styles.noteButtonText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={[styles.noteButton, { backgroundColor: colors.card }]}
                  disabled={mutation.pending}
                  onPress={() => mutation.run(skipNote)}
                >
                  <Text style={[styles.noteButtonText, { color: colors.text }]}>Skip</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: colors.card }]}>
              <Ionicons name="repeat-outline" size={16} color={colors.text} />
              <Text style={[styles.statNumber, { color: colors.text }]}>{timersToday.total}</Text>
              <Text style={[styles.statLabel, { color: colors.lightText }]}>changes</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: colors.card }]}>
              <Ionicons name="water-outline" size={16} color="#185FA5" />
              <Text style={[styles.statNumber, { color: colors.text }]}>{timersToday.wet}</Text>
              <Text style={[styles.statLabel, { color: colors.lightText }]}>wet</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: colors.card }]}>
              <Ionicons name="leaf-outline" size={16} color="#854F0B" />
              <Text style={[styles.statNumber, { color: colors.text }]}>{timersToday.dirty}</Text>
              <Text style={[styles.statLabel, { color: colors.lightText }]}>dirty</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.lightText }]}>Recent changes</Text>

          {history.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="water-outline"
                size={64}
                color={Colors.primary}
                style={{ opacity: 0.4 }}
              />
              <Text style={styles.emptyStateTitle}>No changes logged yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Tap a button above to log your first change
              </Text>
            </View>
          ) : (
            <FlatList
              data={history}
              renderItem={({ item }) => {
                const typeInfo = getTypeIcon(item.type);
                return (
                  <Swipeable renderRightActions={() => renderRightActions(item.id)}>
                    <View style={[styles.historyCard, { backgroundColor: Colors.card }]}>
                      <View style={[styles.typeIcon, { backgroundColor: typeInfo.bgColor }]}>
                        <Ionicons name={typeInfo.icon} size={22} color={typeInfo.color} />
                      </View>

                      <View style={styles.historyInfo}>
                        <Text style={styles.historyType}>
                          {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                        </Text>
                        <Text style={styles.historyTime}>{formatHistoryTime(item.timestamp)}</Text>
                        {item.notes && (
                          <Text style={styles.historyNotes} numberOfLines={1}>
                            {item.notes}
                          </Text>
                        )}
                      </View>

                      <View style={styles.timeAgoPill}>
                        <Text style={styles.timeAgoText}>
                          {getTimeAgo(new Date(item.timestamp).toISOString())}
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
    heroCard: {
      marginHorizontal: Spacing.lg,
      marginBottom: Spacing.xl,
      backgroundColor: Colors.softPrimary,
      borderRadius: 24,
      padding: Spacing.xl,
      alignItems: 'center',
      shadowColor: Colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 3,
    },
    waterDropCircle: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: Colors.softPrimary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    heroLabel: {
      fontSize: 12,
      color: Colors.lightText,
      textTransform: 'uppercase',
      letterSpacing: 1,
      fontWeight: '600',
      marginBottom: Spacing.sm,
    },
    heroTimer: {
      fontSize: 36,
      fontWeight: '700',
      color: Colors.text,
      marginBottom: Spacing.md,
    },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 999,
    },
    statusText: {
      fontSize: 13,
      fontWeight: '500',
    },
    section: {
      marginHorizontal: Spacing.lg,
      marginBottom: Spacing.xl,
    },
    sectionLabel: {
      fontSize: 11,
      color: Colors.lightText,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: Spacing.md,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: Spacing.md,
      justifyContent: 'space-between',
    },
    logButton: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: Spacing.xl,
      borderRadius: 20,
      shadowColor: Colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 3,
    },
    logButtonLabel: {
      fontSize: 14,
      fontWeight: '700',
      marginTop: Spacing.sm,
    },
    notesContainer: {
      marginTop: Spacing.lg,
      gap: Spacing.md,
    },
    notesInput: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Colors.primary,
      padding: Spacing.md,
      fontSize: 14,
      color: Colors.text,
      minHeight: 60,
    },
    notesButtons: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    noteButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.md,
      borderRadius: 12,
      gap: Spacing.sm,
    },
    noteButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.onPrimary,
    },
    statsRow: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    statCard: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: Spacing.md,
      borderRadius: 16,
      shadowColor: Colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 3,
    },
    statNumber: {
      fontSize: 22,
      fontWeight: '700',
      color: Colors.text,
      marginTop: Spacing.sm,
    },
    statLabel: {
      fontSize: 11,
      color: Colors.lightText,
      fontWeight: '600',
      marginTop: Spacing.xs,
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
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 3,
    },
    typeIcon: {
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
    historyNotes: {
      fontSize: 11,
      color: Colors.lightText,
      fontStyle: 'italic',
      marginTop: Spacing.xs,
    },
    timeAgoPill: {
      backgroundColor: Colors.softPrimary,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    timeAgoText: {
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
