import { describe, expect, test } from 'bun:test';
import { indexes, ownedIndexCount } from './system';

describe('indexes system PBT', () => {
  test('check + settle invariants', async () => {
    const report = await indexes.explore({
      episodes: 6,
      steps: 10,
      seed: 1,
      stopOnViolation: true,
    });
    expect(report.ok).toBe(true);
  }, 120_000);

  test('start boots reconciler', async () => {
    await using s = await indexes.script({ seed: 1 });
    expect(await s.observe(ownedIndexCount)).toBe(0);
  }, 60_000);
});
