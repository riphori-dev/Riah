import { useCallback, useRef, useState } from 'react';

/** Prevent duplicate taps synchronously; preserve form data when a write fails. */
export function useAction() {
  const locked = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async (action: () => Promise<void>) => {
    if (locked.current) return;
    locked.current = true;
    setPending(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Something went wrong. Please try again.');
    } finally {
      locked.current = false;
      setPending(false);
    }
  }, []);
  return { run, pending, error, clearError: () => setError(null) };
}
