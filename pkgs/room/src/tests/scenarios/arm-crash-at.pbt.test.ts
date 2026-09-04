import { describe, expect, test } from 'bun:test';

import { counterSystem } from '../apps/counter/system';

describe('room armCrashAt slice PBT', () => {
  test(
    'boundary crashes interleaved with domain ops converge after restart',
    async () => {
      const report = await counterSystem.explore({
        seed: 5,
        episodes: 8,
        steps: 12,
        args: { clientCount: 2, mildFaults: false },
        actions: ['armCrashAt', 'domain', 'restart', 'heal'],
        time: { weight: 1, minMs: 1, maxMs: 30 },
      });
      expect(report.ok).toBe(true);
      expect(report.coverage.actions['armCrashAt'] ?? 0).toBeGreaterThan(0);
    },
    { timeout: 120_000 }
  );
});
