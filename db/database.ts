import * as SQLite from 'expo-sqlite';
import { notifyDataChanged } from '../services/dataEvents';
import { migrateDatabase, tables } from './schema';
import {
  ageInMonths,
  dayBounds,
  parseBirthdate,
  requireFeeding,
  requireNumber,
  requireText,
  requireTimestamp,
  sleepIntervals,
} from '../utils/care';

// Get or open the database
let databasePromise: ReturnType<typeof SQLite.openDatabaseAsync> | null = null;
function getDatabase() {
  if (!databasePromise)
    databasePromise = SQLite.openDatabaseAsync('riah.db').catch((error) => {
      databasePromise = null;
      throw error;
    });
  return databasePromise;
}

/**
 * Type definitions for database records
 */
export interface DiaperLog {
  id: number;
  timestamp: number; // Unix timestamp
  type: 'wet' | 'dirty' | 'both';
  notes: string;
}

export interface FeedingLog {
  id: number;
  timestamp: number; // Unix timestamp
  type: 'breast' | 'bottle' | 'solids';
  amount_ml: number | null;
  duration_minutes: number | null;
  notes: string;
}

export interface SleepLog {
  id: number;
  start_time: number; // Unix timestamp
  end_time: number; // Unix timestamp
  duration_minutes: number;
  type: 'nap' | 'night';
  notes: string;
}

export interface StockItem {
  id: number;
  name: string;
  category: string;
  quantity: number;
  low_stock_threshold: number;
  unit: string;
}

export interface Appointment {
  id: number;
  title: string;
  date: number; // Unix timestamp
  doctor_name: string;
  location: string;
  notes: string;
  is_vaccine: boolean;
  vaccine_name: string | null;
}

export interface BabyProfile {
  id: number;
  name: string;
  age_months: number;
  birthdate: string | null; // ISO date string
  gender: 'girl' | 'boy' | 'neutral';
  created_at: string; // ISO timestamp
}

let initialization: Promise<void> | null = null;
export function initDatabase(): Promise<void> {
  if (!initialization)
    initialization = getDatabase()
      .then(migrateDatabase)
      .catch((error) => {
        initialization = null;
        throw error;
      });
  return initialization;
}

/** Explicit development reset; never invoked during ordinary startup. */
export async function resetTestRecords(): Promise<void> {
  if (!__DEV__) throw new Error('Test reset is only available in development.');
  await initDatabase();
  const database = await getDatabase();
  await database.withTransactionAsync(async () => {
    for (const name of [...tables.map((table) => table.name), 'active_sleep']) {
      await database.execAsync(`DELETE FROM ${name}`);
    }
  });
}

/**
 * DIAPER_LOGS helper functions
 */
export const diaperLogs = {
  async insert(
    timestamp: number,
    type: 'wet' | 'dirty' | 'both',
    notes: string = '',
  ): Promise<number> {
    requireTimestamp(timestamp);
    if (!['wet', 'dirty', 'both'].includes(type)) throw new Error('Choose a diaper type.');
    const database = await getDatabase();
    const result = await database.runAsync(
      `INSERT INTO diaper_logs (timestamp, type, notes) VALUES (?, ?, ?)`,
      [timestamp, type, notes],
    );
    notifyDataChanged();
    return result.lastInsertRowId;
  },

  async getAll(): Promise<DiaperLog[]> {
    const database = await getDatabase();
    const result = await database.getAllAsync<DiaperLog>(
      `SELECT * FROM diaper_logs ORDER BY timestamp DESC`,
    );
    return result;
  },

  async getRecent(limit: number = 5): Promise<DiaperLog[]> {
    const database = await getDatabase();
    const result = await database.getAllAsync<DiaperLog>(
      `SELECT * FROM diaper_logs ORDER BY timestamp DESC LIMIT ?`,
      [limit],
    );
    return result;
  },

  async deleteById(id: number): Promise<void> {
    const database = await getDatabase();
    await database.runAsync(`DELETE FROM diaper_logs WHERE id = ?`, [id]);
    notifyDataChanged();
  },

  async getTodayStats(): Promise<{ total: number; wet: number; dirty: number }> {
    const database = await getDatabase();
    const { start, end } = dayBounds();
    return (
      (await database.getFirstAsync<{ total: number; wet: number; dirty: number }>(
        `SELECT COUNT(*) AS total, COALESCE(SUM(type IN ('wet', 'both')),0) AS wet, COALESCE(SUM(type IN ('dirty', 'both')),0) AS dirty FROM diaper_logs WHERE timestamp >= ? AND timestamp < ?`,
        [start, Math.min(end, Date.now() + 1)],
      )) ?? { total: 0, wet: 0, dirty: 0 }
    );
  },

  async getTodayCount(): Promise<number> {
    const database = await getDatabase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const result = await database.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM diaper_logs WHERE timestamp >= ? AND timestamp < ?`,
      [today.getTime(), tomorrow.getTime()],
    );
    return result?.count || 0;
  },
};

/**
 * FEEDING_LOGS helper functions
 */
export const feedingLogs = {
  async insert(
    timestamp: number,
    type: 'breast' | 'bottle' | 'solids',
    amount_ml: number | null = null,
    duration_minutes: number | null = null,
    notes: string = '',
    session_id: string | null = null,
  ): Promise<number> {
    requireTimestamp(timestamp);
    requireFeeding(type, amount_ml, duration_minutes, notes);
    const database = await getDatabase();
    const result = await database.runAsync(
      `INSERT INTO feeding_logs (timestamp, type, amount_ml, duration_minutes, notes, session_id) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(session_id) DO NOTHING`,
      [timestamp, type, amount_ml, duration_minutes, notes, session_id],
    );
    notifyDataChanged();
    if (!result.changes && session_id) {
      return (await database.getFirstAsync<{ id: number }>(
        'SELECT id FROM feeding_logs WHERE session_id=?',
        [session_id],
      ))!.id;
    }
    return result.lastInsertRowId;
  },

  async getAll(): Promise<FeedingLog[]> {
    const database = await getDatabase();
    const result = await database.getAllAsync<FeedingLog>(
      `SELECT * FROM feeding_logs ORDER BY timestamp DESC`,
    );
    return result;
  },

  async getRecent(limit: number = 5): Promise<FeedingLog[]> {
    const database = await getDatabase();
    const result = await database.getAllAsync<FeedingLog>(
      `SELECT * FROM feeding_logs ORDER BY timestamp DESC LIMIT ?`,
      [limit],
    );
    return result;
  },

  async deleteById(id: number): Promise<void> {
    const database = await getDatabase();
    await database.runAsync(`DELETE FROM feeding_logs WHERE id = ?`, [id]);
    notifyDataChanged();
  },

  async getTodayStats(): Promise<{ total: number; amount: number }> {
    const database = await getDatabase();
    const { start, end } = dayBounds();
    return (
      (await database.getFirstAsync<{ total: number; amount: number }>(
        `SELECT COUNT(*) AS total, COALESCE(SUM(amount_ml),0) AS amount FROM feeding_logs WHERE timestamp >= ? AND timestamp < ?`,
        [start, Math.min(end, Date.now() + 1)],
      )) ?? { total: 0, amount: 0 }
    );
  },

  async getTodayCount(): Promise<number> {
    const database = await getDatabase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const result = await database.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM feeding_logs WHERE timestamp >= ? AND timestamp < ?`,
      [today.getTime(), tomorrow.getTime()],
    );
    return result?.count || 0;
  },
};

/**
 * SLEEP_LOGS helper functions
 */
export const sleepLogs = {
  async insert(
    start_time: number,
    end_time: number,
    duration_minutes: number,
    type: 'nap' | 'night',
    notes: string = '',
  ): Promise<number> {
    requireTimestamp(start_time);
    requireTimestamp(end_time);
    if (end_time <= start_time) throw new Error('Sleep must end after it starts.');
    duration_minutes = Math.round((end_time - start_time) / 60000);
    const database = await getDatabase();
    const result = await database.runAsync(
      `INSERT INTO sleep_logs (start_time, end_time, duration_minutes, type, notes) VALUES (?, ?, ?, ?, ?)`,
      [start_time, end_time, duration_minutes, type, notes],
    );
    notifyDataChanged();
    return result.lastInsertRowId;
  },

  async getAll(): Promise<SleepLog[]> {
    const database = await getDatabase();
    const result = await database.getAllAsync<SleepLog>(
      `SELECT * FROM sleep_logs ORDER BY start_time DESC`,
    );
    return result;
  },

  async getRecent(limit: number = 5): Promise<SleepLog[]> {
    const database = await getDatabase();
    const result = await database.getAllAsync<SleepLog>(
      `SELECT * FROM sleep_logs ORDER BY start_time DESC LIMIT ?`,
      [limit],
    );
    return result;
  },

  async deleteById(id: number): Promise<void> {
    const database = await getDatabase();
    await database.runAsync(`DELETE FROM sleep_logs WHERE id = ?`, [id]);
    notifyDataChanged();
  },

  async getTodayTotal(): Promise<number> {
    const { start } = dayBounds();
    const logs = await sleepLogs.getTodayLogs();
    return Math.round(
      sleepIntervals(logs, start, Date.now()).reduce((sum, [a, b]) => sum + b - a, 0) / 60000,
    );
  },
  async getTodayLogs(): Promise<SleepLog[]> {
    const database = await getDatabase();
    const { start } = dayBounds();
    return database.getAllAsync<SleepLog>(
      `SELECT * FROM sleep_logs WHERE end_time > ? AND start_time < ? ORDER BY start_time DESC`,
      [start, Date.now()],
    );
  },
};

/**
 * STOCK_ITEMS helper functions
 */
export const stockItems = {
  async insert(
    name: string,
    category: string,
    quantity: number,
    low_stock_threshold: number,
    unit: string,
  ): Promise<number> {
    name = requireText(name, 'an item name');
    unit = requireText(unit, 'a unit');
    category = requireText(category, 'a category');
    requireNumber(quantity, 'Quantity');
    requireNumber(low_stock_threshold, 'Low stock threshold');
    const database = await getDatabase();
    const result = await database.runAsync(
      `INSERT INTO stock_items (name, category, quantity, low_stock_threshold, unit) VALUES (?, ?, ?, ?, ?)`,
      [name, category, quantity, low_stock_threshold, unit],
    );
    notifyDataChanged();
    return result.lastInsertRowId;
  },

  async adjustQuantity(id: number, delta: number): Promise<void> {
    requireNumber(Math.abs(delta), 'Quantity change', 1);
    const database = await getDatabase();
    const result = await database.runAsync(
      `UPDATE stock_items SET quantity = MAX(0, quantity + ?) WHERE id = ?`,
      [delta, id],
    );
    if (!result.changes) throw new Error('This item no longer exists. Refresh your stock.');
    notifyDataChanged();
  },

  async getAll(): Promise<StockItem[]> {
    const database = await getDatabase();
    const result = await database.getAllAsync<StockItem>(
      `SELECT * FROM stock_items ORDER BY name ASC`,
    );
    return result;
  },

  async getRecent(limit: number = 5): Promise<StockItem[]> {
    const database = await getDatabase();
    const result = await database.getAllAsync<StockItem>(
      `SELECT * FROM stock_items ORDER BY id DESC LIMIT ?`,
      [limit],
    );
    return result;
  },

  async deleteById(id: number): Promise<void> {
    const database = await getDatabase();
    await database.runAsync(`DELETE FROM stock_items WHERE id = ?`, [id]);
    notifyDataChanged();
  },
};

/**
 * APPOINTMENTS helper functions
 */
export const appointments = {
  async insert(
    title: string,
    date: number,
    doctor_name: string = '',
    location: string = '',
    notes: string = '',
    is_vaccine: boolean = false,
    vaccine_name: string | null = null,
  ): Promise<number> {
    title = requireText(title, 'an appointment title');
    requireNumber(date, 'Appointment time', 1);
    const database = await getDatabase();
    const result = await database.runAsync(
      `INSERT INTO appointments (title, date, doctor_name, location, notes, is_vaccine, vaccine_name) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title, date, doctor_name, location, notes, is_vaccine ? 1 : 0, vaccine_name],
    );
    notifyDataChanged();
    return result.lastInsertRowId;
  },

  async update(id: number, values: Omit<Appointment, 'id'>): Promise<void> {
    const title = requireText(values.title, 'an appointment title');
    requireNumber(values.date, 'Appointment time', 1);
    const database = await getDatabase();
    const result = await database.runAsync(
      `UPDATE appointments SET title=?, date=?, doctor_name=?, location=?, notes=?, is_vaccine=?, vaccine_name=? WHERE id=?`,
      [
        title,
        values.date,
        values.doctor_name,
        values.location,
        values.notes,
        values.is_vaccine ? 1 : 0,
        values.vaccine_name,
        id,
      ],
    );
    if (!result.changes)
      throw new Error('This appointment no longer exists. Refresh your appointments.');
    notifyDataChanged();
  },

  async getAll(): Promise<Appointment[]> {
    const database = await getDatabase();
    const result = await database.getAllAsync<Appointment>(
      `SELECT * FROM appointments ORDER BY date DESC`,
    );
    return result.map((apt) => ({
      ...apt,
      is_vaccine: Boolean(apt.is_vaccine),
    }));
  },

  async getRecent(limit: number = 5): Promise<Appointment[]> {
    const database = await getDatabase();
    const result = await database.getAllAsync<Appointment>(
      `SELECT * FROM appointments ORDER BY date DESC LIMIT ?`,
      [limit],
    );
    return result.map((apt) => ({
      ...apt,
      is_vaccine: Boolean(apt.is_vaccine),
    }));
  },

  async deleteById(id: number): Promise<void> {
    const database = await getDatabase();
    await database.runAsync(`DELETE FROM appointments WHERE id = ?`, [id]);
    notifyDataChanged();
  },

  async getUpcoming(days: number = 7): Promise<Appointment[]> {
    const database = await getDatabase();
    const now = Date.now();
    const future = now + days * 24 * 60 * 60 * 1000;

    const result = await database.getAllAsync<Appointment>(
      `SELECT * FROM appointments WHERE date >= ? AND date <= ? ORDER BY date ASC`,
      [now, future],
    );
    return result.map((apt) => ({
      ...apt,
      is_vaccine: Boolean(apt.is_vaccine),
    }));
  },
};

/**
 * BABY_PROFILE helper functions
 */
export const babyProfile = {
  async insert(
    name: string,
    age_months: number,
    birthdate: string | null = null,
    gender: 'girl' | 'boy' | 'neutral' = 'neutral',
  ): Promise<number> {
    const database = await getDatabase();

    requireText(name, 'a name');
    if (birthdate) age_months = ageInMonths(parseBirthdate(birthdate));
    requireNumber(age_months, 'Age');
    const existing = await babyProfile.get();
    if (existing) return existing.id;

    const created_at = new Date().toISOString();
    const result = await database.runAsync(
      `INSERT INTO baby_profile (name, age_months, birthdate, gender, created_at) VALUES (?, ?, ?, ?, ?)`,
      [name, age_months, birthdate, gender, created_at],
    );
    notifyDataChanged();
    return result.lastInsertRowId;
  },

  async update(id: number, name: string, gender: BabyProfile['gender']): Promise<void> {
    name = requireText(name, 'a name');
    if (!['girl', 'boy', 'neutral'].includes(gender)) throw new Error('Choose a valid gender.');
    const database = await getDatabase();
    const result = await database.runAsync('UPDATE baby_profile SET name=?, gender=? WHERE id=?', [
      name,
      gender,
      id,
    ]);
    if (!result.changes)
      throw new Error('Your profile could not be found. Reopen the app to try again.');
    notifyDataChanged();
  },

  async get(): Promise<BabyProfile | null> {
    const database = await getDatabase();
    const result = await database.getFirstAsync<BabyProfile>(
      `SELECT * FROM baby_profile ORDER BY created_at DESC LIMIT 1`,
    );
    return result || null;
  },

  async deleteById(id: number): Promise<void> {
    const database = await getDatabase();
    await database.runAsync(`DELETE FROM baby_profile WHERE id = ?`, [id]);
    notifyDataChanged();
  },
};

// Export notification service functions separately
export const getLatestDiaperLog = async (): Promise<DiaperLog | null> => {
  const database = await getDatabase();
  const result = await database.getFirstAsync<DiaperLog>(
    `SELECT * FROM diaper_logs ORDER BY timestamp DESC LIMIT 1`,
  );
  return result || null;
};

export const getLatestFeedingLog = async (): Promise<FeedingLog | null> => {
  const database = await getDatabase();
  const result = await database.getFirstAsync<FeedingLog>(
    `SELECT * FROM feeding_logs ORDER BY timestamp DESC LIMIT 1`,
  );
  return result || null;
};

export const getLowStockItems = async (): Promise<StockItem[]> => {
  const database = await getDatabase();
  const result = await database.getAllAsync<StockItem>(
    `SELECT * FROM stock_items WHERE quantity <= low_stock_threshold`,
  );
  return result;
};

export const getUpcomingAppointments = async (): Promise<Appointment[]> => {
  const database = await getDatabase();
  const now = Date.now();
  const future = now + 7 * 24 * 60 * 60 * 1000; // 7 days ahead

  const result = await database.getAllAsync<Appointment>(
    `SELECT * FROM appointments WHERE date >= ? AND date <= ? ORDER BY date ASC`,
    [now, future],
  );
  return result.map((apt) => ({
    ...apt,
    is_vaccine: Boolean(apt.is_vaccine),
  }));
};

export interface ActiveSleep {
  session_id: string;
  start_time: number;
  type: 'nap' | 'night';
}
let sleepQueue: Promise<unknown> = Promise.resolve();
function serializeSleep<T>(action: () => Promise<T>): Promise<T> {
  const result = sleepQueue.catch(() => {}).then(action);
  sleepQueue = result;
  return result;
}
export const activeSleep = {
  async get(): Promise<ActiveSleep | null> {
    return (await getDatabase()).getFirstAsync<ActiveSleep>(
      'SELECT session_id, start_time, type FROM active_sleep WHERE id=1',
    );
  },
  async start(type: 'nap' | 'night', start = Date.now()): Promise<ActiveSleep> {
    return serializeSleep(async () => {
      requireTimestamp(start);
      const database = await getDatabase();
      await database.runAsync(
        'INSERT OR IGNORE INTO active_sleep(id, session_id, start_time, type) VALUES(1, ?, ?, ?)',
        [`sleep-${start}`, start, type],
      );
      notifyDataChanged();
      return (await activeSleep.get())!;
    });
  },
  async stop(): Promise<void> {
    return serializeSleep(async () => {
      const database = await getDatabase();
      await database.withTransactionAsync(async () => {
        const session = await activeSleep.get();
        if (!session) return;
        const end = Math.max(Date.now(), session.start_time + 1);
        await database.runAsync(
          `INSERT OR IGNORE INTO sleep_logs(start_time,end_time,duration_minutes,type,notes,session_id)
        VALUES(?,?,?,?,?,?)`,
          [
            session.start_time,
            end,
            Math.round((end - session.start_time) / 60000),
            session.type,
            '',
            session.session_id,
          ],
        );
        await database.runAsync('DELETE FROM active_sleep WHERE id=1 AND session_id=?', [
          session.session_id,
        ]);
      });
      notifyDataChanged();
    });
  },
};
