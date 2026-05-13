import * as SQLite from 'expo-sqlite';

// Get or open the database
const db = SQLite.openDatabaseAsync('riah.db');

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
  age_months: number;
  birthdate: string | null; // ISO date string
  gender: 'girl' | 'boy' | 'neutral';
  created_at: string; // ISO timestamp
}

/**
 * Initialize database - creates all tables if they don't exist
 */
export async function initDatabase(): Promise<void> {
  try {
    console.log('Initializing database...');
    const database = await db;
    console.log('Database opened successfully');

    // Create all tables sequentially with error handling
    const tables = [
      {
        name: 'diaper_logs',
        sql: `
          CREATE TABLE IF NOT EXISTS diaper_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp INTEGER NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('wet', 'dirty', 'both')),
            notes TEXT
          );
        `
      },
      {
        name: 'feeding_logs',
        sql: `
          CREATE TABLE IF NOT EXISTS feeding_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp INTEGER NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('breast', 'bottle', 'solids')),
            amount_ml REAL,
            duration_minutes INTEGER,
            notes TEXT
          );
        `
      },
      {
        name: 'sleep_logs',
        sql: `
          CREATE TABLE IF NOT EXISTS sleep_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            start_time INTEGER NOT NULL,
            end_time INTEGER NOT NULL,
            duration_minutes INTEGER NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('nap', 'night')),
            notes TEXT
          );
        `
      },
      {
        name: 'stock_items',
        sql: `
          CREATE TABLE IF NOT EXISTS stock_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            low_stock_threshold INTEGER NOT NULL,
            unit TEXT NOT NULL
          );
        `
      },
      {
        name: 'appointments',
        sql: `
          CREATE TABLE IF NOT EXISTS appointments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            date INTEGER NOT NULL,
            doctor_name TEXT,
            location TEXT,
            notes TEXT,
            is_vaccine INTEGER DEFAULT 0,
            vaccine_name TEXT
          );
        `
      },
      {
        name: 'baby_profile',
        sql: `
          CREATE TABLE IF NOT EXISTS baby_profile (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            age_months INTEGER,
            birthdate TEXT,
            gender TEXT DEFAULT 'neutral',
            created_at TEXT
          );
        `
      }
    ];

    // Create each table with error handling
    for (const table of tables) {
      try {
        console.log(`Creating ${table.name} table...`);
        await database.execAsync(table.sql);
        console.log(`${table.name} table created successfully`);
      } catch (error) {
        console.error(`Error creating ${table.name} table:`, error);
      }
    }

    // Verify all tables were created
    const createdTables = await database.getAllAsync('SELECT name FROM sqlite_master WHERE type="table"');
    console.log('✅ All tables created:', createdTables.map((t: any) => t.name));

  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

/**
 * DIAPER_LOGS helper functions
 */
export const diaperLogs = {
  async insert(
    timestamp: number,
    type: 'wet' | 'dirty' | 'both',
    notes: string = ''
  ): Promise<number> {
    const database = await db;
    const result = await database.runAsync(
      `INSERT INTO diaper_logs (timestamp, type, notes) VALUES (?, ?, ?)`,
      [timestamp, type, notes]
    );
    return result.lastInsertRowId;
  },

  async getAll(): Promise<DiaperLog[]> {
    const database = await db;
    const result = await database.getAllAsync<DiaperLog>(
      `SELECT * FROM diaper_logs ORDER BY timestamp DESC`
    );
    return result;
  },

  async getRecent(limit: number = 5): Promise<DiaperLog[]> {
    const database = await db;
    const result = await database.getAllAsync<DiaperLog>(
      `SELECT * FROM diaper_logs ORDER BY timestamp DESC LIMIT ?`,
      [limit]
    );
    return result;
  },

  async deleteById(id: number): Promise<void> {
    const database = await db;
    await database.runAsync(`DELETE FROM diaper_logs WHERE id = ?`, [id]);
  },

  async getTodayCount(): Promise<number> {
    const database = await db;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const result = await database.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM diaper_logs WHERE timestamp >= ? AND timestamp < ?`,
      [today.getTime(), tomorrow.getTime()]
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
    notes: string = ''
  ): Promise<number> {
    const database = await db;
    const result = await database.runAsync(
      `INSERT INTO feeding_logs (timestamp, type, amount_ml, duration_minutes, notes) VALUES (?, ?, ?, ?, ?)`,
      [timestamp, type, amount_ml, duration_minutes, notes]
    );
    return result.lastInsertRowId;
  },

  async getAll(): Promise<FeedingLog[]> {
    const database = await db;
    const result = await database.getAllAsync<FeedingLog>(
      `SELECT * FROM feeding_logs ORDER BY timestamp DESC`
    );
    return result;
  },

  async getRecent(limit: number = 5): Promise<FeedingLog[]> {
    const database = await db;
    const result = await database.getAllAsync<FeedingLog>(
      `SELECT * FROM feeding_logs ORDER BY timestamp DESC LIMIT ?`,
      [limit]
    );
    return result;
  },

  async deleteById(id: number): Promise<void> {
    const database = await db;
    await database.runAsync(`DELETE FROM feeding_logs WHERE id = ?`, [id]);
  },

  async getTodayCount(): Promise<number> {
    const database = await db;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const result = await database.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM feeding_logs WHERE timestamp >= ? AND timestamp < ?`,
      [today.getTime(), tomorrow.getTime()]
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
    notes: string = ''
  ): Promise<number> {
    const database = await db;
    const result = await database.runAsync(
      `INSERT INTO sleep_logs (start_time, end_time, duration_minutes, type, notes) VALUES (?, ?, ?, ?, ?)`,
      [start_time, end_time, duration_minutes, type, notes]
    );
    return result.lastInsertRowId;
  },

  async getAll(): Promise<SleepLog[]> {
    const database = await db;
    const result = await database.getAllAsync<SleepLog>(
      `SELECT * FROM sleep_logs ORDER BY start_time DESC`
    );
    return result;
  },

  async getRecent(limit: number = 5): Promise<SleepLog[]> {
    const database = await db;
    const result = await database.getAllAsync<SleepLog>(
      `SELECT * FROM sleep_logs ORDER BY start_time DESC LIMIT ?`,
      [limit]
    );
    return result;
  },

  async deleteById(id: number): Promise<void> {
    const database = await db;
    await database.runAsync(`DELETE FROM sleep_logs WHERE id = ?`, [id]);
  },

  async getTodayTotal(): Promise<number> {
    const database = await db;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const result = await database.getFirstAsync<{ total: number }>(
      `SELECT SUM(duration_minutes) as total FROM sleep_logs WHERE start_time >= ? AND start_time < ?`,
      [today.getTime(), tomorrow.getTime()]
    );
    return result?.total || 0;
  },

  async getTodayLogs(): Promise<SleepLog[]> {
    const database = await db;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const result = await database.getAllAsync<SleepLog>(
      `SELECT * FROM sleep_logs WHERE start_time >= ? AND start_time < ? ORDER BY start_time DESC`,
      [today.getTime(), tomorrow.getTime()]
    );
    return result;
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
    unit: string
  ): Promise<number> {
    const database = await db;
    const result = await database.runAsync(
      `INSERT INTO stock_items (name, category, quantity, low_stock_threshold, unit) VALUES (?, ?, ?, ?, ?)`,
      [name, category, quantity, low_stock_threshold, unit]
    );
    return result.lastInsertRowId;
  },

  async getAll(): Promise<StockItem[]> {
    const database = await db;
    const result = await database.getAllAsync<StockItem>(
      `SELECT * FROM stock_items ORDER BY name ASC`
    );
    return result;
  },

  async getRecent(limit: number = 5): Promise<StockItem[]> {
    const database = await db;
    const result = await database.getAllAsync<StockItem>(
      `SELECT * FROM stock_items ORDER BY id DESC LIMIT ?`,
      [limit]
    );
    return result;
  },

  async deleteById(id: number): Promise<void> {
    const database = await db;
    await database.runAsync(`DELETE FROM stock_items WHERE id = ?`, [id]);
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
    vaccine_name: string | null = null
  ): Promise<number> {
    const database = await db;
    const result = await database.runAsync(
      `INSERT INTO appointments (title, date, doctor_name, location, notes, is_vaccine, vaccine_name) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title, date, doctor_name, location, notes, is_vaccine ? 1 : 0, vaccine_name]
    );
    return result.lastInsertRowId;
  },

  async getAll(): Promise<Appointment[]> {
    const database = await db;
    const result = await database.getAllAsync<Appointment>(
      `SELECT * FROM appointments ORDER BY date DESC`
    );
    return result.map((apt) => ({
      ...apt,
      is_vaccine: Boolean(apt.is_vaccine),
    }));
  },

  async getRecent(limit: number = 5): Promise<Appointment[]> {
    const database = await db;
    const result = await database.getAllAsync<Appointment>(
      `SELECT * FROM appointments ORDER BY date DESC LIMIT ?`,
      [limit]
    );
    return result.map((apt) => ({
      ...apt,
      is_vaccine: Boolean(apt.is_vaccine),
    }));
  },

  async deleteById(id: number): Promise<void> {
    const database = await db;
    await database.runAsync(`DELETE FROM appointments WHERE id = ?`, [id]);
  },

  async getUpcoming(days: number = 7): Promise<Appointment[]> {
    const database = await db;
    const now = Date.now();
    const future = now + (days * 24 * 60 * 60 * 1000);
    
    const result = await database.getAllAsync<Appointment>(
      `SELECT * FROM appointments WHERE date >= ? AND date <= ? ORDER BY date ASC`,
      [now, future]
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
    age_months: number,
    birthdate: string | null = null,
    gender: 'girl' | 'boy' | 'neutral' = 'neutral'
  ): Promise<number> {
    const database = await db;
    
    // Ensure table exists before inserting
    try {
      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS baby_profile (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          age_months INTEGER NOT NULL,
          birthdate TEXT,
          gender TEXT CHECK(gender IN ('girl', 'boy', 'neutral')),
          created_at TEXT NOT NULL
        );
      `);
      console.log('baby_profile table ensured to exist');
    } catch (error) {
      console.error('Error ensuring baby_profile table:', error);
    }
    
    const created_at = new Date().toISOString();
    const result = await database.runAsync(
      `INSERT INTO baby_profile (age_months, birthdate, gender, created_at) VALUES (?, ?, ?, ?)`,
      [age_months, birthdate, gender, created_at]
    );
    return result.lastInsertRowId;
  },

  async get(): Promise<BabyProfile | null> {
    const database = await db;
    const result = await database.getFirstAsync<BabyProfile>(
      `SELECT * FROM baby_profile ORDER BY created_at DESC LIMIT 1`
    );
    return result || null;
  },

  async deleteById(id: number): Promise<void> {
    const database = await db;
    await database.runAsync(`DELETE FROM baby_profile WHERE id = ?`, [id]);
  },
};

// Export notification service functions separately
export const getLatestDiaperLog = async (): Promise<DiaperLog | null> => {
  const database = await db;
  const result = await database.getFirstAsync<DiaperLog>(
    `SELECT * FROM diaper_logs ORDER BY timestamp DESC LIMIT 1`
  );
  return result || null;
};

export const getLatestFeedingLog = async (): Promise<FeedingLog | null> => {
  const database = await db;
  const result = await database.getFirstAsync<FeedingLog>(
    `SELECT * FROM feeding_logs ORDER BY timestamp DESC LIMIT 1`
  );
  return result || null;
};

export const getLowStockItems = async (): Promise<StockItem[]> => {
  const database = await db;
  const result = await database.getAllAsync<StockItem>(
    `SELECT * FROM stock_items WHERE quantity <= low_stock_threshold`
  );
  return result;
};

export const getUpcomingAppointments = async (): Promise<Appointment[]> => {
  const database = await db;
  const now = Date.now();
  const future = now + (7 * 24 * 60 * 60 * 1000); // 7 days ahead
  
  const result = await database.getAllAsync<Appointment>(
    `SELECT * FROM appointments WHERE date >= ? AND date <= ? ORDER BY date ASC`,
    [now, future]
  );
  return result.map((apt) => ({
    ...apt,
    is_vaccine: Boolean(apt.is_vaccine),
  }));
};
