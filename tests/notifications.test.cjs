const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./helpers.cjs');

function reminderHarness() {
  const pending = new Map(),
    sent = [],
    cancelled = [];
  let granted = true,
    fail = false;
  const h = harness({
    'react-native': {
      Platform: { OS: 'android' },
      AppState: { addEventListener: () => ({ remove() {} }) },
    },
    'expo-notifications': {
      AndroidImportance: { DEFAULT: 3 },
      SchedulableTriggerInputTypes: { DATE: 'date' },
      getPermissionsAsync: async () => ({ granted }),
      requestPermissionsAsync: async () => ({ granted }),
      setNotificationHandler() {},
      setNotificationChannelAsync: async () => {},
      getAllScheduledNotificationsAsync: async () => [...pending.values()],
      cancelScheduledNotificationAsync: async (id) => {
        cancelled.push(id);
        pending.delete(id);
      },
      scheduleNotificationAsync: async (request) => {
        if (fail) {
          fail = false;
          throw new Error('Notification schedule failed');
        }
        sent.push(request);
        if (request.trigger) pending.set(request.identifier, request);
        return request.identifier;
      },
    },
  });
  return {
    ...h,
    pending,
    sent,
    cancelled,
    deny: () => {
      granted = false;
    },
    failSchedule: () => {
      fail = true;
    },
  };
}

test('reminders reconcile without duplicate schedules and cancel deleted appointment IDs', async () => {
  const h = reminderHarness();
  let service;
  try {
    const db = h.load('db/database.ts');
    await db.initDatabase();
    await db.babyProfile.insert('Test baby', 1, '2026-01-01');
    h.storage.set('appOpenTime', String(Date.now()));
    const id = await db.appointments.insert('Checkup', Date.now() + 9 * 86400000);
    service = h.load('services/notifications.ts').default;
    await service.refresh();
    const count = h.sent.length;
    assert.equal(count, 6);
    await service.refresh();
    assert.equal(h.sent.length, count);
    assert.ok(h.sent.every((request) => request.content.data.screen));
    await db.appointments.deleteById(id);
    await service.refresh();
    assert.equal(h.cancelled.filter((id) => id.startsWith('riah-appointment-')).length, 4);
    assert.equal(
      [...h.pending.keys()].some((id) => id.startsWith('riah-appointment-')),
      false,
    );
  } finally {
    service?.cleanup();
    h.close();
  }
});

test('failed notification schedules do not mark success; denied permission has no schedules', async () => {
  const h = reminderHarness();
  let service;
  try {
    const db = h.load('db/database.ts');
    await db.initDatabase();
    await db.babyProfile.insert('Test baby', 1, '2026-01-01');
    h.storage.set('appOpenTime', String(Date.now() - 3 * 3600000));
    service = h.load('services/notifications.ts').default;
    h.failSchedule();
    await assert.rejects(service.refresh(), /schedule failed/);
    assert.equal(h.storage.has('riah-diaper-first'), false);
    await service.refresh();
    assert.equal(h.sent.length, 2);
    await service.refresh();
    assert.equal(h.sent.length, 2);
    h.deny();
    await service.refresh();
    assert.equal(h.sent.length, 2);
  } finally {
    service?.cleanup();
    h.close();
  }
});
