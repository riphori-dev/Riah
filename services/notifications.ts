import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLatestDiaperLog, getLatestFeedingLog, getLowStockItems, getUpcomingAppointments } from '../db/database';

interface StockItem {
  id: number;
  name: string;
  category: string;
  quantity: number;
  low_stock_threshold: number;
  unit: string;
}

export class NotificationService {
  private static checkInterval: NodeJS.Timeout | null = null;
  private static readonly CHECK_INTERVAL = 60 * 60 * 1000; // 60 minutes

  static async initialize() {
    try {
      // Request permissions
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Notification permissions not granted');
        await AsyncStorage.setItem('notifPermission', status);
        return;
      }
      
      await AsyncStorage.setItem('notifPermission', 'granted');

      // Set notification handler
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });

      // Configure notification channel for Android
      await Notifications.setNotificationChannelAsync('riah-alerts', {
        name: 'Riah Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
      });

      // Start background checks
      this.checkInterval = setInterval(() => {
        NotificationService.runAllChecks();
      }, this.CHECK_INTERVAL);

      // Run checks immediately on startup
      await NotificationService.runAllChecks();

      console.log('Notification service initialized');
    } catch (error) {
      console.error('Error initializing notification service:', error);
    }
  }

  static async runAllChecks() {
    try {
      await Promise.all([
        this.checkDiaperAlert(),
        this.checkFeedingAlert(),
        this.checkStockAlert(),
        this.checkAppointmentAlert(),
      ]);
    } catch (error) {
      console.error('Error running notification checks:', error);
    }
  }

  static async checkDiaperAlert() {
    try {
      const latestLog = await getLatestDiaperLog();
      
      if (!latestLog) {
        // No logs exist, notify after app has been open for 2 hours
        const appOpenTime = await AsyncStorage.getItem('appOpenTime');
        if (appOpenTime) {
          const timeSinceOpen = Date.now() - parseInt(appOpenTime);
          if (timeSinceOpen >= 2 * 60 * 60 * 1000) {
            await this.sendNotification('First diaper log 👶', "Don't forget to log baby's first diaper change in Riah!");
          }
        }
        return;
      }

      const timeSinceLastChange = Date.now() - latestLog.timestamp;
      const hoursSince = timeSinceLastChange / (1000 * 60 * 60);

      // Check spam prevention
      const lastNotifTime = await AsyncStorage.getItem('lastDiaperNotif');
      if (lastNotifTime) {
        const timeSinceLastNotif = Date.now() - parseInt(lastNotifTime);
        if (timeSinceLastNotif < 2 * 60 * 60 * 1000) {
          return; // Don't spam if last notification was less than 2 hours ago
        }
      }

      if (hoursSince >= 4) {
        await this.sendNotification('Diaper change needed! 🚨', "It's been over 4 hours since the last diaper change. Baby might need attention!");
      } else if (hoursSince >= 3) {
        await this.sendNotification('Diaper check 💧', "It's been 3 hours since the last diaper change. Time to check!");
      }

      // Save notification timestamp
      await AsyncStorage.setItem('lastDiaperNotif', Date.now().toString());
    } catch (error) {
      console.error('Error checking diaper alert:', error);
    }
  }

  static async checkFeedingAlert() {
    try {
      const latestLog = await getLatestFeedingLog();
      
      if (!latestLog) {
        // No logs exist, notify after app has been open for 2 hours
        const appOpenTime = await AsyncStorage.getItem('appOpenTime');
        if (appOpenTime) {
          const timeSinceOpen = Date.now() - parseInt(appOpenTime);
          if (timeSinceOpen >= 2 * 60 * 60 * 1000) {
            await this.sendNotification('First feeding log 🍼', "Remember to log baby's feedings so Riah can track pattern!");
          }
        }
        return;
      }

      const timeSinceLastFeed = Date.now() - latestLog.timestamp;
      const hoursSince = timeSinceLastFeed / (1000 * 60 * 60);

      // Check spam prevention
      const lastNotifTime = await AsyncStorage.getItem('lastFeedingNotif');
      if (lastNotifTime) {
        const timeSinceLastNotif = Date.now() - parseInt(lastNotifTime);
        if (timeSinceLastNotif < 2 * 60 * 60 * 1000) {
          return; // Don't spam if last notification was less than 2 hours ago
        }
      }

      if (hoursSince >= 3.5) {
        await this.sendNotification('Baby might be hungry! 🚨', "It's been over 3.5 hours since the last feeding. Time to feed!");
      } else if (hoursSince >= 2.5) {
        await this.sendNotification('Feeding time? 🍼', "It's been 2.5 hours since the last feed. Baby might be getting hungry!");
      }

      // Save notification timestamp
      await AsyncStorage.setItem('lastFeedingNotif', Date.now().toString());
    } catch (error) {
      console.error('Error checking feeding alert:', error);
    }
  }

  static async checkStockAlert() {
    try {
      const lowStockItems = await getLowStockItems();
      
      if (lowStockItems.length === 0) {
        return; // No low stock items
      }

      // Check spam prevention (only notify once every 12 hours for stock alerts)
      const lastNotifTime = await AsyncStorage.getItem('lastStockNotif');
      if (lastNotifTime) {
        const timeSinceLastNotif = Date.now() - parseInt(lastNotifTime);
        if (timeSinceLastNotif < 12 * 60 * 60 * 1000) {
          return; // Don't spam stock notifications
        }
      }

      if (lowStockItems.length === 1) {
        const item: StockItem = lowStockItems[0];
        await this.sendNotification(
          `Running low on ${item.name} 📦`,
          `You have ${item.quantity} ${item.unit} left. Time to restock!`
        );
      } else {
        const itemNames = lowStockItems.map(item => item.name).join(', ');
        await this.sendNotification(
          `${lowStockItems.length} items running low 📦`,
          `Low stock: ${itemNames}. Check your stock in Riah.`
        );
      }

      // Save notification timestamp
      await AsyncStorage.setItem('lastStockNotif', Date.now().toString());
    } catch (error) {
      console.error('Error checking stock alert:', error);
    }
  }

  static async checkAppointmentAlert() {
    try {
      const upcomingAppointments = await getUpcomingAppointments();
      
      if (upcomingAppointments.length === 0) {
        return; // No upcoming appointments
      }

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      for (const appointment of upcomingAppointments) {
        const appointmentDate = new Date(appointment.date);
        const daysUntil = Math.floor((appointmentDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const hoursUntil = (daysUntil * 24) + (appointmentDate.getHours() - now.getHours());

        // Check spam prevention
        const lastNotifKey = `lastApptNotif_${appointment.id}`;
        const lastNotifTime = await AsyncStorage.getItem(lastNotifKey);
        if (lastNotifTime) {
          const timeSinceLastNotif = Date.now() - parseInt(lastNotifTime);
          const daysSinceLastNotif = timeSinceLastNotif / (1000 * 60 * 60 * 24);
          if (daysSinceLastNotif < 1) {
            continue; // Don't send same appointment notification multiple times
          }
        }

        let title = '';
        let body = '';
        const formattedDate = appointmentDate.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        });
        const formattedTime = appointmentDate.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit' 
        });

        if (daysUntil === 7 && Math.abs(hoursUntil) <= 1) {
          title = 'Appointment next week 📅';
          body = `${appointment.title} with ${appointment.doctor_name || 'doctor'} is in 7 days on ${formattedDate}.`;
        } else if (daysUntil === 3 && Math.abs(hoursUntil) <= 1) {
          title = 'Appointment in 3 days 📅';
          body = `${appointment.title} with ${appointment.doctor_name || 'doctor'} on ${formattedDate} at ${formattedTime}.`;
        } else if (daysUntil === 1 && Math.abs(hoursUntil) <= 1) {
          title = 'Appointment tomorrow! 📅';
          body = `Don't forget: ${appointment.title} with ${appointment.doctor_name || 'doctor'} tomorrow at ${formattedTime}.`;
        } else if (daysUntil === 0 && Math.abs(hoursUntil) <= 1) {
          title = 'Appointment today! 🏥';
          body = `${appointment.title} with ${appointment.doctor_name || 'doctor'} is today at ${formattedTime}. Get ready!`;
        }

        if (title && body) {
          const finalTitle = appointment.is_vaccine ? `💉 Vaccine: ${title}` : title;
          await this.sendNotification(finalTitle, body);
          
          // Save notification timestamp
          await AsyncStorage.setItem(lastNotifKey, Date.now().toString());
        }
      }
    } catch (error) {
      console.error('Error checking appointment alert:', error);
    }
  }

  static async sendNotification(title: string, body: string) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null, // send immediately
      });
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }

  static cleanup() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}

export default NotificationService;
