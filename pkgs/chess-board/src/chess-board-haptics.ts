/**
 * Optional mobile haptics. No-ops when `navigator.vibrate` is missing.
 */

export type Haptics = {
  readonly light: () => void;
  readonly medium: () => void;
  readonly illegal: () => void;
};

export function createBoardHaptics(enabled: () => boolean): Haptics {
  const vibrate = (pattern: number | number[]): void => {
    if (!enabled()) return;
    const nav = globalThis.navigator;
    if (nav === undefined || typeof nav.vibrate !== 'function') return;
    nav.vibrate(pattern);
  };
  return {
    light: () => vibrate(8),
    medium: () => vibrate(16),
    illegal: () => vibrate([12, 40, 12]),
  };
}
