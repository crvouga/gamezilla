import { describe, expect, test } from 'bun:test';
import {
  createRecordingHaptics,
  createVibrationHaptics,
  HAPTIC_PATTERNS,
  noopHaptics,
} from '@pkgs/device/haptics';

describe('haptics', () => {
  test('recording port captures calls in order', () => {
    const h = createRecordingHaptics();
    h.selection();
    h.error();
    h.success();
    expect(h.calls).toEqual(['selection', 'error', 'success']);
    h.clear();
    expect(h.calls).toEqual([]);
  });

  test('vibration port maps kinds to patterns', () => {
    const patterns: (readonly number[])[] = [];
    const h = createVibrationHaptics({
      vibrate: (p) => {
        patterns.push(p);
        return true;
      },
    });
    h.selection();
    h.success();
    h.error();
    expect(patterns).toEqual([
      HAPTIC_PATTERNS.selection,
      HAPTIC_PATTERNS.success,
      HAPTIC_PATTERNS.error,
    ]);
  });

  test('noop port does nothing', () => {
    const h = noopHaptics();
    expect(() => {
      h.selection();
      h.success();
      h.error();
    }).not.toThrow();
  });
});
