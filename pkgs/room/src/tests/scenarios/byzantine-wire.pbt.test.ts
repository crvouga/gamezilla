import { describe, expect, test } from 'bun:test';

import { counterSystem } from '../apps/counter/system';

describe('room byzantine-wire PBT', () => {
  test(
    'hostile frames on either direction never break server truth',
    async () => {
      const report = await counterSystem.explore({
        seed: 9,
        episodes: 8,
        steps: 12,
        actions: ['byzantine', 'domain', 'heal'],
        time: { weight: 1, minMs: 1, maxMs: 20 },
      });
      expect(report.ok).toBe(true);
      expect(report.coverage.actions['byzantine'] ?? 0).toBeGreaterThan(0);
    },
    { timeout: 120_000 }
  );
});
