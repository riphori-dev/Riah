const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./helpers.cjs');

test('explicit development reset clears records atomically and refuses production', async () => {
  const h = harness();
  const previous = global.__DEV__;
  try {
    const db = h.load('db/database.ts');
    await db.initDatabase();
    await db.diaperLogs.insert(Date.now(), 'wet');
    global.__DEV__ = false;
    await assert.rejects(db.resetTestRecords(), /development/);
    assert.equal((await db.diaperLogs.getAll()).length, 1);
    global.__DEV__ = true;
    h.failNext('DELETE FROM feeding_logs');
    await assert.rejects(db.resetTestRecords(), /Injected/);
    assert.equal((await db.diaperLogs.getAll()).length, 1);
    await db.resetTestRecords();
    for (const { name } of h.sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name != 'sqlite_sequence'")
      .all()) {
      assert.equal(h.sqlite.prepare(`SELECT count(*) n FROM ${name}`).get().n, 0);
    }
    await db.diaperLogs.insert(Date.now(), 'both');
    assert.equal((await db.diaperLogs.getAll()).length, 1);
  } finally {
    global.__DEV__ = previous;
    h.close();
  }
});

test('fresh and legacy schemas migrate idempotently without deleting existing profiles', async () => {
  for (const legacy of [false, true]) {
    const h = harness();
    try {
      if (legacy)
        h.sqlite
          .exec(`CREATE TABLE baby_profile(id INTEGER PRIMARY KEY, age_months INTEGER, birthdate TEXT, gender TEXT, created_at TEXT);
        INSERT INTO baby_profile VALUES(42, 2, '2026-01-01', 'neutral', '2026-03-01');`);
      const { migrateDatabase } = h.load('db/schema.ts');
      await migrateDatabase(h.database);
      await migrateDatabase(h.database);
      assert.equal(h.sqlite.prepare('PRAGMA user_version').get().user_version, 3);
      assert.ok(
        h.sqlite
          .prepare('PRAGMA table_info(baby_profile)')
          .all()
          .some((c) => c.name === 'name'),
      );
      if (legacy) assert.equal(h.sqlite.prepare('SELECT id FROM baby_profile').get().id, 42);
    } finally {
      h.close();
    }
  }
});

test('migration failure rolls back; unknown future schema is refused', async () => {
  const h = harness();
  try {
    const { migrateDatabase } = h.load('db/schema.ts');
    h.failNext('CREATE TABLE IF NOT EXISTS feeding_logs');
    await assert.rejects(migrateDatabase(h.database), /Injected/);
    assert.equal(h.sqlite.prepare('PRAGMA user_version').get().user_version, 0);
    assert.equal(
      h.sqlite.prepare("SELECT count(*) n FROM sqlite_master WHERE name='diaper_logs'").get().n,
      0,
    );
    h.sqlite.exec('PRAGMA user_version=99');
    await assert.rejects(migrateDatabase(h.database), /newer/);
  } finally {
    h.close();
  }
});

test('stock quantity deltas and appointment edits preserve IDs and survive rejected updates', async () => {
  const h = harness();
  try {
    const db = h.load('db/database.ts');
    await db.initDatabase();
    const stock = await db.stockItems.insert('Formula', 'Formula', 1, 1, 'cans');
    await Promise.all(Array.from({ length: 20 }, () => db.stockItems.adjustQuantity(stock, 1)));
    assert.equal((await db.stockItems.getAll())[0].quantity, 21);
    h.failNext('UPDATE stock_items');
    await assert.rejects(db.stockItems.adjustQuantity(stock, 1));
    assert.equal((await db.stockItems.getAll())[0].id, stock);
    const id = await db.appointments.insert('Original', Date.now() + 86400000);
    const values = {
      title: 'Edited',
      date: Date.now() + 86400000,
      doctor_name: 'Dr',
      location: 'Clinic',
      notes: '',
      is_vaccine: false,
      vaccine_name: null,
    };
    h.failNext('UPDATE appointments');
    await assert.rejects(db.appointments.update(id, values));
    assert.equal((await db.appointments.getAll())[0].title, 'Original');
    await db.appointments.update(id, values);
    assert.equal((await db.appointments.getAll())[0].id, id);
    assert.equal((await db.appointments.getAll())[0].title, 'Edited');
  } finally {
    h.close();
  }
});

test('daily totals include more than 15 records, mixed diapers, and overnight sleep', async () => {
  const h = harness();
  try {
    const db = h.load('db/database.ts');
    await db.initDatabase();
    const now = Date.now();
    for (let i = 0; i < 20; i++) {
      await db.diaperLogs.insert(now, 'both');
      await db.feedingLogs.insert(now, 'bottle', 10);
    }
    assert.deepEqual(await db.diaperLogs.getTodayStats(), { total: 20, wet: 20, dirty: 20 });
    assert.deepEqual(await db.feedingLogs.getTodayStats(), { total: 20, amount: 200 });
    const { start } = h.load('utils/care.ts').dayBounds();
    const end = Math.min(now, start + 3600000);
    await db.sleepLogs.insert(start - 3600000, end, 999, 'night');
    assert.equal(await db.sleepLogs.getTodayTotal(), Math.round((end - start) / 60000));
    await assert.rejects(db.sleepLogs.insert(now, now - 1, -1, 'nap'));
    await assert.rejects(db.feedingLogs.insert(now, 'bottle', -20));
  } finally {
    h.close();
  }
});

test('active sleep persists across reads, stop is idempotent, failed save retains session', async () => {
  const h = harness();
  try {
    const db = h.load('db/database.ts');
    await db.initDatabase();
    const session = await db.activeSleep.start('nap', Date.now() - 600000);
    assert.equal((await db.activeSleep.start('night')).session_id, session.session_id);
    h.failNext('INSERT OR IGNORE INTO sleep_logs');
    await assert.rejects(db.activeSleep.stop());
    assert.equal((await db.activeSleep.get()).session_id, session.session_id);
    await Promise.all([db.activeSleep.stop(), db.activeSleep.stop()]);
    assert.equal(await db.activeSleep.get(), null);
    assert.equal((await db.sleepLogs.getAll()).length, 1);
  } finally {
    h.close();
  }
});

test('retrying the same breast session after a failed timer reset never duplicates its feeding log', async () => {
  const h = harness();
  try {
    const db = h.load('db/database.ts');
    await db.initDatabase();
    const first = await db.feedingLogs.insert(Date.now(), 'breast', null, 5, '', 'same-session');
    const retry = await db.feedingLogs.insert(Date.now(), 'breast', null, 6, '', 'same-session');
    assert.equal(first, retry);
    assert.equal((await db.feedingLogs.getAll()).length, 1);
  } finally {
    h.close();
  }
});

test('profile settings persist both the name and the selected gender', async () => {
  const h = harness();
  try {
    const db = h.load('db/database.ts');
    await db.initDatabase();
    const id = await db.babyProfile.insert('Preview', 1, '2026-01-01');
    await db.babyProfile.update(id, 'Updated', 'girl');
    assert.equal((await db.babyProfile.get()).name, 'Updated');
    assert.equal((await db.babyProfile.get()).gender, 'girl');
    assert.equal((await db.babyProfile.get()).id, id);
  } finally {
    h.close();
  }
});
