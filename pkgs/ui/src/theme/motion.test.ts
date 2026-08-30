import { describe, expect, test } from 'bun:test';
import { duration, motion } from './motion';

describe('motion tokens', () => {
  test('all durations are zero (nuclear overhaul)', () => {
    expect(duration.instant).toBe(0);
    expect(duration.fast).toBe(0);
    expect(duration.normal).toBe(0);
    expect(duration.slow).toBe(0);
    expect(duration.slower).toBe(0);
    expect(motion.duration).toBe(duration);
  });
});
