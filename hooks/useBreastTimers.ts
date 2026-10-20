import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BreastSession,
  emptyBreastSession,
  parseBreastSession,
  timerSeconds,
  toggleTimer,
} from '@/utils/feedingTimer';

const KEY = 'breastSessionV1';
export function useBreastTimers() {
  const session = useRef(emptyBreastSession());
  const lock = useRef(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, tick] = useState(0);
  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!mounted) return;
        session.current = parseBreastSession(raw);
        setReady(true);
      })
      .catch(() => {
        if (mounted)
          setError('Unable to restore your feeding timer. Reopen this screen to try again.');
      });
    const interval = setInterval(() => tick((value) => value + 1), 1000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const commit = async (next: BreastSession) => {
    if (!ready || lock.current) return;
    lock.current = true;
    setError(null);
    try {
      await AsyncStorage.setItem(KEY, JSON.stringify(next));
      session.current = next;
      tick((value) => value + 1);
    } catch {
      setError('Unable to save the feeding timer. Please try again.');
      throw new Error('The feeding timer could not be saved.');
    } finally {
      lock.current = false;
    }
  };
  const view = (side: 'left' | 'right') => ({
    running: session.current[side].startedAt !== null,
    duration: timerSeconds(session.current[side]),
  });
  return {
    sessionId: session.current.id,
    breastTimers: { left: view('left'), right: view('right') },
    ready,
    error,
    toggleBreastTimer: (side: 'left' | 'right') =>
      commit({ ...session.current, [side]: toggleTimer(session.current[side]) }),
    resetBreastTimer: (side: 'left' | 'right') =>
      commit({ ...session.current, [side]: { elapsed: 0, startedAt: null } }),
    resetAll: () => commit(emptyBreastSession()),
  };
}
