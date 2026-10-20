import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import {
  appointments,
  babyProfile,
  getLatestDiaperLog,
  getLatestFeedingLog,
  getLowStockItems,
} from '../db/database';
import { subscribeToDataChanges } from './dataEvents';
import { appointmentReminders, Reminder } from '../utils/reminders';

const CHANNEL = 'riah-alerts';
export default class NotificationService {
  private static unsubscribe: (() => void) | null = null;
  private static appState: ReturnType<typeof AppState.addEventListener> | null = null;
  private static queue: Promise<void> = Promise.resolve();
  private static timer: ReturnType<typeof setTimeout> | null = null;

  static async initialize() {
    if (Platform.OS === 'web') return;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    if (Platform.OS === 'android')
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: 'Riah reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    if (!this.unsubscribe) {
      this.unsubscribe = subscribeToDataChanges(() => this.refreshSoon());
      this.appState = AppState.addEventListener('change', (state) => {
        if (state === 'active') this.refreshSoon();
      });
    }
    await this.refresh();
  }

  private static refreshSoon() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.refresh().catch((error) => console.warn('Reminder refresh failed:', error));
    }, 300);
  }

  /** Request permission from explanatory Settings control, never while loading onboarding. */
  static async enable(): Promise<boolean> {
    if (Platform.OS === 'web') return false;
    if (Platform.OS === 'android')
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: 'Riah reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    const permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) return false;
    await this.initialize();
    return true;
  }

  static refresh(): Promise<void> {
    if (Platform.OS === 'web') return Promise.resolve();
    this.queue = this.queue.catch(() => {}).then(() => this.reconcile());
    return this.queue;
  }

  private static async reconcile() {
    if (!(await Notifications.getPermissionsAsync()).granted) return;
    const [profile, allAppointments, diaper, feeding, stock] = await Promise.all([
      babyProfile.get(),
      appointments.getAll(),
      getLatestDiaperLog(),
      getLatestFeedingLog(),
      getLowStockItems(),
    ]);
    if (!profile) return;
    const now = Date.now();
    const desired: Reminder[] = appointmentReminders(allAppointments, now);
    const opened = Number(await AsyncStorage.getItem('appOpenTime')) || now;
    for (const [kind, log, hours, screen] of [
      ['diaper', diaper, 3, '/diaper'],
      ['feeding', feeding, 2.5, '/feeding'],
    ] as const) {
      const at = log ? log.timestamp + hours * 3_600_000 : opened + 2 * 3_600_000;
      const id = `riah-${kind}-${log?.id ?? 'first'}`;
      const sent = await AsyncStorage.getItem(id);
      if (at > now || !sent)
        desired.push({
          id,
          at: Math.max(at, now),
          screen,
          title: kind === 'diaper' ? 'Time for a diaper check?' : 'Time for a feeding check?',
          body: `Check ${profile.name || 'your baby'} and log the next ${kind === 'diaper' ? 'change' : 'feed'} when ready.`,
        });
    }
    const lastStock = Number(await AsyncStorage.getItem('lastStockNotif')) || 0;
    if (stock.length && now - lastStock >= 12 * 3_600_000)
      desired.push({
        id: 'riah-stock',
        at: now,
        screen: '/stock',
        title: 'Supplies running low',
        body: stock.map((item) => item.name).join(', '),
      });
    const selected = desired.sort((a, b) => a.at - b.at).slice(0, 48);
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    const keep = new Set(selected.map((reminder) => reminder.id));
    for (const request of pending) {
      if (request.identifier.startsWith('riah-') && !keep.has(request.identifier)) {
        await Notifications.cancelScheduledNotificationAsync(request.identifier);
      }
    }
    for (const reminder of selected) {
      const existing = pending.find((request) => request.identifier === reminder.id);
      if (existing?.content.data?.at === reminder.at && existing.content.body === reminder.body)
        continue;
      await Notifications.scheduleNotificationAsync({
        identifier: reminder.id,
        content: {
          title: reminder.title,
          body: reminder.body,
          sound: 'default',
          data: { screen: reminder.screen, at: reminder.at },
        },
        trigger:
          reminder.at <= now
            ? null
            : {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: new Date(reminder.at),
                channelId: CHANNEL,
              },
      });
      if (reminder.id === 'riah-stock') await AsyncStorage.setItem('lastStockNotif', String(now));
      else if (!reminder.id.startsWith('riah-appointment-'))
        await AsyncStorage.setItem(reminder.id, String(reminder.at));
    }
  }

  static async stopForReset() {
    this.cleanup();
    await this.queue.catch(() => {});
    if (Platform.OS === 'web') return;
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      pending
        .filter((item) => item.identifier.startsWith('riah-'))
        .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)),
    );
  }

  static cleanup() {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.appState?.remove();
    this.appState = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
