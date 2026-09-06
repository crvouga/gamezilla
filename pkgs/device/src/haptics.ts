/**
 * Haptic feedback port. UI code receives a {@link HapticsPort} by injection;
 * the browser adapter lives in {@link ./wall-web-device.ts}.
 */

export type HapticKind = 'selection' | 'success' | 'error';

export type HapticsPort = {
  /** Light tick — piece pick-up, toggle, selection change. */
  readonly selection: () => void;
  /** Medium impact — move applied, action confirmed. */
  readonly success: () => void;
  /** Error notification — illegal move, rejected action. */
  readonly error: () => void;
};

/** Silent port for hosts without a vibration surface (desktop, tests). */
export function noopHaptics(): HapticsPort {
  return { selection: () => {}, success: () => {}, error: () => {} };
}

export type RecordingHaptics = HapticsPort & {
  readonly calls: readonly HapticKind[];
  readonly clear: () => void;
};

/** Test / sim port that records every call in order. */
export function createRecordingHaptics(): RecordingHaptics {
  const calls: HapticKind[] = [];
  return {
    calls,
    clear: () => {
      calls.length = 0;
    },
    selection: () => {
      calls.push('selection');
    },
    success: () => {
      calls.push('success');
    },
    error: () => {
      calls.push('error');
    },
  };
}

/** Vibration patterns (ms) used by {@link createVibrationHaptics}. */
export const HAPTIC_PATTERNS: Readonly<Record<HapticKind, readonly number[]>> =
  {
    selection: [8],
    success: [20],
    error: [30, 40, 30],
  };

export type Vibrator = {
  /** `navigator.vibrate` — returns false when the pattern was rejected. */
  readonly vibrate: (pattern: readonly number[]) => boolean;
};

/** Port over an injected {@link Vibrator} (the Vibration API shape). */
export function createVibrationHaptics(vibrator: Vibrator): HapticsPort {
  const fire = (kind: HapticKind): void => {
    vibrator.vibrate(HAPTIC_PATTERNS[kind]);
  };
  return {
    selection: () => fire('selection'),
    success: () => fire('success'),
    error: () => fire('error'),
  };
}
