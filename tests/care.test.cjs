const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./helpers.cjs');

test('civil dates, complete months, invalid dates and sleep overlap boundaries', () => {
  const h = harness();
  try {
    const c = h.load('utils/care.ts');
    const date = new Date(2026, 9, 20);
    assert.equal(c.localDateString(date), '2026-10-20');
    assert.equal(c.ageInMonths(new Date(2026, 8, 21), date), 0);
    assert.equal(c.ageInMonths(new Date(2026, 8, 20), date), 1);
    assert.throws(() => c.parseBirthdate('2026-02-31'));
    assert.throws(() => c.parseBirthdate('2099-01-01'));
    assert.equal(c.localDateString(c.parseBirthdate('2024-02-29')), '2024-02-29');
    assert.deepEqual(
      c.sleepIntervals(
        [
          { start_time: 0, end_time: 30 },
          { start_time: 20, end_time: 50 },
          { start_time: 60, end_time: 200 },
        ],
        10,
        100,
      ),
      [
        [10, 50],
        [60, 100],
      ],
    );
  } finally {
    h.close();
  }
});

test('shared feeding validation rejects blank/negative/nonfinite values from any form', () => {
  const h = harness();
  try {
    const c = h.load('utils/care.ts');
    for (const value of [null, -1, 0, NaN, Infinity])
      assert.throws(() => c.requireFeeding('bottle', value, null, ''));
    assert.throws(() => c.requireFeeding('breast', null, null, ''));
    assert.throws(() => c.requireFeeding('solids', null, null, ' '));
    assert.doesNotThrow(() => c.requireFeeding('bottle', 120, null, ''));
    assert.equal(c.isLowStock(1, 1), true);
  } finally {
    h.close();
  }
});

test('breast timers include suspended wall time and exclude pauses, recoverable from storage', () => {
  const h = harness();
  try {
    const t = h.load('utils/feedingTimer.ts');
    let side = t.toggleTimer({ elapsed: 0, startedAt: null }, 1000);
    assert.equal(t.timerSeconds(side, 121000), 120);
    side = t.toggleTimer(side, 121000);
    assert.equal(t.timerSeconds(side, 999000), 120);
    side = t.toggleTimer(side, 999000);
    assert.equal(t.timerSeconds(side, 1009000), 130);
    const session = t.emptyBreastSession();
    session.left = side;
    assert.deepEqual(t.parseBreastSession(JSON.stringify(session)), session);
    assert.throws(() => t.parseBreastSession('{"left":{"elapsed":-1}}'));
  } finally {
    h.close();
  }
});

test('appointment reminders cover 7/3/1 days and one hour, without past schedules', () => {
  const h = harness();
  try {
    const { appointmentReminders } = h.load('utils/reminders.ts');
    const date = new Date(2026, 10, 10, 14, 30).getTime();
    const reminders = appointmentReminders(
      [{ id: 7, date, title: 'Checkup' }],
      date - 10 * 86400000,
    );
    assert.equal(reminders.length, 4);
    assert.equal(new Date(reminders[0].at).getDate(), 3);
    assert.equal(new Date(reminders[1].at).getDate(), 7);
    assert.equal(new Date(reminders[2].at).getDate(), 9);
    assert.equal(reminders[3].at, date - 3600000);
    assert.equal(new Set(reminders.map((r) => r.id)).size, 4);
    assert.deepEqual(appointmentReminders([{ id: 7, date, title: 'Checkup' }], date), []);
  } finally {
    h.close();
  }
});
