/** Domain rules shared by detailed screens, quick logging and persistence. */
export function requireText(value: string, label: string): string {
  if (!value.trim()) throw new Error(`Enter ${label}.`);
  return value.trim();
}

export function requireNumber(value: number, label: string, minimum = 0): number {
  if (!Number.isFinite(value) || value < minimum) {
    throw new Error(`${label} must be a number of at least ${minimum}.`);
  }
  return value;
}

export function requireTimestamp(value: number): void {
  requireNumber(value, 'Time', 1);
  if (value > Date.now() + 60_000) throw new Error('Choose a time that is not in the future.');
}

export function requireFeeding(
  type: string,
  amount: number | null,
  duration: number | null,
  notes: string,
): void {
  if (!['breast', 'bottle', 'solids'].includes(type)) throw new Error('Choose a feeding type.');
  if (amount !== null) requireNumber(amount, 'Amount', 0.01);
  if (duration !== null) requireNumber(duration, 'Duration', 0.01);
  if (type === 'bottle' && amount === null) throw new Error('Enter the bottle amount in ml.');
  if (type === 'breast' && duration === null) throw new Error('Enter the feeding duration.');
  if (type === 'solids') requireText(notes, 'the food name or feeding details');
}

export function isLowStock(quantity: number, threshold: number): boolean {
  return quantity <= threshold;
}

export function localDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function parseBirthdate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error('Choose a valid birthdate.');
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (localDateString(date) !== value || date.getTime() > Date.now()) {
    throw new Error('Choose a valid birthdate that is not in the future.');
  }
  return date;
}

export function ageInMonths(birthdate: Date, now = new Date()): number {
  return Math.max(
    0,
    (now.getFullYear() - birthdate.getFullYear()) * 12 +
      now.getMonth() -
      birthdate.getMonth() -
      (now.getDate() < birthdate.getDate() ? 1 : 0),
  );
}

export function dayBounds(now = new Date()): { start: number; end: number } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.getTime(), end: end.getTime() };
}

/** Merge overlaps so accidental duplicate/overlapping sessions never double-count sleep. */
export function sleepIntervals(
  logs: { start_time: number; end_time: number }[],
  start: number,
  end: number,
) {
  const intervals = logs
    .map(
      (log) => [Math.max(start, log.start_time), Math.min(end, log.end_time)] as [number, number],
    )
    .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && b > a)
    .sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const interval of intervals) {
    const last = merged[merged.length - 1];
    if (last && interval[0] <= last[1]) last[1] = Math.max(last[1], interval[1]);
    else merged.push([...interval]);
  }
  return merged;
}
