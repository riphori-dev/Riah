export interface MigrationDatabase {
  execAsync(sql: string): Promise<void>;
  getFirstAsync<T>(sql: string): Promise<T | null>;
  getAllAsync<T>(sql: string): Promise<T[]>;
  withTransactionAsync(action: () => Promise<void>): Promise<void>;
}

export const tables = [
  {
    name: 'diaper_logs',
    sql: `
          CREATE TABLE IF NOT EXISTS diaper_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp INTEGER NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('wet', 'dirty', 'both')),
            notes TEXT
          );
        `,
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
        `,
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
        `,
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
        `,
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
        `,
  },
  {
    name: 'baby_profile',
    sql: `
          CREATE TABLE IF NOT EXISTS baby_profile (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT DEFAULT 'Baby',
            age_months INTEGER,
            birthdate TEXT,
            gender TEXT DEFAULT 'neutral',
            created_at TEXT
          );
        `,
  },
];

export async function migrateDatabase(database: MigrationDatabase): Promise<void> {
  const version = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if ((version?.user_version ?? 0) > 3) throw new Error('This data needs a newer version of Riah.');
  await database.withTransactionAsync(async () => {
    for (const table of tables) await database.execAsync(table.sql);
    const profile = await database.getAllAsync<{ name: string }>('PRAGMA table_info(baby_profile)');
    if (!profile.some((column) => column.name === 'name')) {
      await database.execAsync("ALTER TABLE baby_profile ADD COLUMN name TEXT DEFAULT 'Baby'");
    }
    const sleep = await database.getAllAsync<{ name: string }>('PRAGMA table_info(sleep_logs)');
    if (!sleep.some((column) => column.name === 'session_id')) {
      await database.execAsync('ALTER TABLE sleep_logs ADD COLUMN session_id TEXT');
    }
    const feeding = await database.getAllAsync<{ name: string }>('PRAGMA table_info(feeding_logs)');
    if (!feeding.some((column) => column.name === 'session_id')) {
      await database.execAsync('ALTER TABLE feeding_logs ADD COLUMN session_id TEXT');
    }
    for (const table of tables) {
      const columns = await database.getAllAsync<{ name: string }>(
        `PRAGMA table_info(${table.name})`,
      );
      const expected = [...table.sql.matchAll(/^\s+(\w+) (?:INTEGER|TEXT|REAL)/gm)].map(
        (match) => match[1],
      );
      if (expected.some((name) => !columns.some((column) => column.name === name))) {
        throw new Error(`The ${table.name} table needs repair. Your records have been preserved.`);
      }
    }
    await database.execAsync(`
      CREATE UNIQUE INDEX IF NOT EXISTS feeding_session_id ON feeding_logs(session_id);
      CREATE UNIQUE INDEX IF NOT EXISTS sleep_session_id ON sleep_logs(session_id);
      CREATE TABLE IF NOT EXISTS active_sleep (
        id INTEGER PRIMARY KEY CHECK(id = 1), session_id TEXT NOT NULL,
        start_time INTEGER NOT NULL, type TEXT NOT NULL CHECK(type IN ('nap', 'night'))
      );
      CREATE INDEX IF NOT EXISTS diaper_timestamp ON diaper_logs(timestamp);
      CREATE INDEX IF NOT EXISTS feeding_timestamp ON feeding_logs(timestamp);
      CREATE INDEX IF NOT EXISTS sleep_start ON sleep_logs(start_time);
      CREATE INDEX IF NOT EXISTS appointment_date ON appointments(date);
      PRAGMA user_version = 3;
    `);
  });
}
