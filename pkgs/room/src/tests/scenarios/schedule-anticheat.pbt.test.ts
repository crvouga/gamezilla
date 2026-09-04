import { describe, expect, test } from 'bun:test';

import { matchClockSystem } from '../apps/match-clock/system';

describe('room schedule-anticheat PBT', () => {
  test(
    'start / move / flag-fall interleaved with held links converge past the clock',
    async () => {
      const report = await matchClockSystem.explore({
        seed: 51,
        episodes: 6,
        steps: 14,
        args: { clientCount: 2 },
        actions: ['domain', 'hold', 'release', 'heal'],
        time: { weight: 2, minMs: 10, maxMs: 2_500 },
      });
      expect(report.ok).toBe(true);
      expect(report.coverage.actions['domain'] ?? 0).toBeGreaterThan(0);
    },
    { timeout: 180_000 }
  );
});
