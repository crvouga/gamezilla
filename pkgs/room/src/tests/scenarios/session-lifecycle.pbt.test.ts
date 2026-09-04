import { describe, expect, test } from 'bun:test';

import { counterSystem } from '../apps/counter/system';

const TIME = { weight: 1, minMs: 1, maxMs: 40 } as const;

describe('room session-lifecycle PBT', () => {
  test(
    'disconnect / connect / takeOver around domain ops converge',
    async () => {
      const report = await counterSystem.explore({
        seed: 41,
        episodes: 8,
        steps: 14,
        actions: ['disconnect', 'connect', 'takeOver', 'domain', 'heal'],
        time: TIME,
      });
      expect(report.ok).toBe(true);
      expect(report.coverage.actions['takeOver'] ?? 0).toBeGreaterThan(0);
    },
    { timeout: 120_000 }
  );

  test(
    'crash / restart / clearLocalData around domain ops converge',
    async () => {
      const report = await counterSystem.explore({
        seed: 42,
        episodes: 8,
        steps: 14,
        actions: [
          'crash',
          'restart',
          'clearLocalData',
          'disconnect',
          'domain',
          'heal',
        ],
        time: TIME,
      });
      expect(report.ok).toBe(true);
      expect(report.coverage.actions['crash'] ?? 0).toBeGreaterThan(0);
    },
    { timeout: 120_000 }
  );

  test(
    'server crash / restart drains pending domain ops',
    async () => {
      const report = await counterSystem.explore({
        seed: 43,
        episodes: 6,
        steps: 12,
        actions: ['serverCrash', 'serverRestart', 'domain', 'heal'],
        time: TIME,
      });
      expect(report.ok).toBe(true);
      expect(report.coverage.actions['serverCrash'] ?? 0).toBeGreaterThan(0);
    },
    { timeout: 120_000 }
  );
});
