import { useEffect } from 'react';

/**
 * Automatically locks the household ledger after `autoLockMinutes` of user inactivity.
 */
export function useAutoLock(
  pinEnabled: boolean,
  autoLockMinutes: number,
  isUnlocked: boolean,
  onLock: () => void
): void {
  useEffect(() => {
    if (!pinEnabled || !autoLockMinutes || autoLockMinutes <= 0 || !isUnlocked) return;

    const timeoutMs = autoLockMinutes * 60_000;
    let timerId = window.setTimeout(onLock, timeoutMs);
    let lastReset = Date.now();

    const resetTimer = () => {
      const now = Date.now();
      if (now - lastReset < 1000) return;
      lastReset = now;
      window.clearTimeout(timerId);
      timerId = window.setTimeout(onLock, timeoutMs);
    };

    const events = ['pointerdown', 'keydown', 'touchstart'] as const;
    events.forEach((evt) => window.addEventListener(evt, resetTimer, { passive: true }));
    return () => {
      window.clearTimeout(timerId);
      events.forEach((evt) => window.removeEventListener(evt, resetTimer));
    };
  }, [pinEnabled, autoLockMinutes, isUnlocked, onLock]);
}
