import { describe, expect, test } from 'bun:test';

import { counterSystem } from '../apps/counter/system';

const TIME = { weight: 1, minMs: 1, maxMs: 40 } as const;

describe('room net-faults PBT', () => {
  test(
    'hold / down / release around domain ops converge on heal',
    async () => {
      const report = await counterSystem.explore({
        seed: 31,
        episodes: 8,
        steps: 14,
        actions: ['hold', 'down', 'release', 'domain', 'heal'],
        time: TIME,
      });
      expect(report.ok).toBe(true);
    },
    { timeout: 120_000 }
  );

  test(
    'asymmetric links around domain ops converge on heal',
    async () => {
      const report = await counterSystem.explore({
        seed: 32,
        episodes: 8,
        steps: 14,
        actions: ['asymmetricLink', 'release', 'domain', 'heal'],
        time: TIME,
      });
      expect(report.ok).toBe(true);
      expect(report.coverage.actions['asymmetricLink'] ?? 0).toBeGreaterThan(0);
    },
    { timeout: 120_000 }
  );

  test(
    'lossy / reordering / duplicating profiles converge on heal',
    async () => {
      const report = await counterSystem.explore({
        seed: 33,
        episodes: 8,
        steps: 14,
        actions: ['setFaults', 'domain', 'heal'],
        time: TIME,
      });
      expect(report.ok).toBe(true);
      expect(report.coverage.actions['setFaults'] ?? 0).toBeGreaterThan(0);
    },
    { timeout: 120_000 }
  );
});
