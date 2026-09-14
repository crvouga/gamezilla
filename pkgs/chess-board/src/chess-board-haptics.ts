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
    const vibrateFn = Reflect.get(globalThis.navigator, 'vibrate');
    if (typeof vibrateFn !== 'function') return;
    (vibrateFn as (this: Navigator, p: number | number[]) => boolean).call(
      globalThis.navigator,
      pattern
    );
  };
  return {
    light: () => vibrate(8),
    medium: () => vibrate(16),
    illegal: () => vibrate([12, 40, 12]),
  };
}
