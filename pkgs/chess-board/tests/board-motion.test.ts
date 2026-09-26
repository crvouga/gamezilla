import { describe, expect, test } from 'bun:test';
import {
  DEFAULT_MOVE_DURATION_MS,
  isLowEndDevice,
  MAX_SETTLE_DURATION_MS,
  resolveMotionPolicy,
  settleDurationMs,
} from '@pkgs/chess-board/board-motion';
import { assertProperty } from '@pkgs/property';
import fc from 'fast-check';

const inputs = fc.record({
  enabled: fc.boolean(),
  durationMs: fc.option(fc.double({ min: -500, max: 5000, noNaN: true }), {
    nil: undefined,
  }),
  prefersReducedMotion: fc.boolean(),
  lowEnd: fc.boolean(),
  canAnimate: fc.boolean(),
});

describe('resolveMotionPolicy', () => {
  test('reduce-motion, animations off or no Web Animations never slide', () => {
    assertProperty(
      'motion-off',
      fc.property(inputs, (input) => {
        const policy = resolveMotionPolicy(input);
        if (!input.enabled || input.prefersReducedMotion || !input.canAnimate) {
          expect(policy).toEqual({
            slides: false,
            durationMs: 0,
            effects: false,
          });
        }
      })
    );
  });

  test('a slide always has a positive whole duration; no slide has none', () => {
    assertProperty(
      'motion-duration',
      fc.property(inputs, (input) => {
        const policy = resolveMotionPolicy(input);
        expect(Number.isInteger(policy.durationMs)).toBe(true);
        expect(policy.slides).toBe(policy.durationMs > 0);
      })
    );
  });

  test('low-end devices keep slides but drop paint-heavy effects', () => {
    assertProperty(
      'motion-low-end',
      fc.property(inputs, (input) => {
        const policy = resolveMotionPolicy(input);
        if (input.lowEnd) expect(policy.effects).toBe(false);
        const full = resolveMotionPolicy({ ...input, lowEnd: false });
        expect(policy.slides).toBe(full.slides);
        expect(policy.durationMs).toBe(full.durationMs);
      })
    );
  });

  test('defaults to chess.com speed with every effect', () => {
    expect(
      resolveMotionPolicy({
        enabled: true,
        durationMs: undefined,
        prefersReducedMotion: false,
        lowEnd: false,
        canAnimate: true,
      })
    ).toEqual({
      slides: true,
      durationMs: DEFAULT_MOVE_DURATION_MS,
      effects: true,
    });
  });
});

describe('settleDurationMs', () => {
  test('a settle is never slower than the move nor the settle cap', () => {
    assertProperty(
      'settle-duration',
      fc.property(fc.integer({ min: 0, max: 10_000 }), (ms) => {
        const settle = settleDurationMs(ms);
        expect(settle).toBeLessThanOrEqual(ms);
        expect(settle).toBeLessThanOrEqual(MAX_SETTLE_DURATION_MS);
      })
    );
  });
});

describe('isLowEndDevice', () => {
  test('flags ≤ 2 GB, ≤ 2 cores or Save-Data; missing hints never count', () => {
    expect(isLowEndDevice(undefined)).toBe(false);
    expect(isLowEndDevice({})).toBe(false);
    expect(isLowEndDevice({ deviceMemory: 2 })).toBe(true);
    expect(isLowEndDevice({ deviceMemory: 4, hardwareConcurrency: 8 })).toBe(
      false
    );
    expect(isLowEndDevice({ hardwareConcurrency: 2 })).toBe(true);
    expect(isLowEndDevice({ hardwareConcurrency: 0 })).toBe(false);
    expect(isLowEndDevice({ connection: { saveData: true } })).toBe(true);
  });
});
