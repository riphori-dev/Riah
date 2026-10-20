export interface TimerSide {
  elapsed: number;
  startedAt: number | null;
}
export interface BreastSession {
  id: string;
  left: TimerSide;
  right: TimerSide;
}
export function emptyBreastSession(): BreastSession {
  return {
    id: `breast-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    left: { elapsed: 0, startedAt: null },
    right: { elapsed: 0, startedAt: null },
  };
}
export function timerSeconds(timer: TimerSide, now = Date.now()): number {
  return Math.floor(
    (timer.elapsed + (timer.startedAt === null ? 0 : Math.max(0, now - timer.startedAt))) / 1000,
  );
}
export function toggleTimer(timer: TimerSide, now = Date.now()): TimerSide {
  return timer.startedAt === null
    ? { ...timer, startedAt: now }
    : { elapsed: timer.elapsed + Math.max(0, now - timer.startedAt), startedAt: null };
}
export function parseBreastSession(raw: string | null): BreastSession {
  if (!raw) return emptyBreastSession();
  const value = JSON.parse(raw) as BreastSession;
  if (typeof value.id !== 'string' || !value.id) throw new Error('Invalid feeding session.');
  for (const side of [value.left, value.right]) {
    if (
      !side ||
      !Number.isFinite(side.elapsed) ||
      side.elapsed < 0 ||
      (side.startedAt !== null &&
        (!Number.isFinite(side.startedAt) || side.startedAt <= 0 || side.startedAt > Date.now()))
    ) {
      throw new Error(
        'Unable to restore the feeding timer. Your saved session has been preserved.',
      );
    }
  }
  return value;
}
