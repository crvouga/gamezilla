import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import { check } from '@pkgs/dst/pbt';
import {
  INDEXES_ACTIONS,
  INDEXES_PROPERTIES,
  indexes,
  ownedIndexCount,
} from './system';

describe('indexes-world system PBT', () => {
  test('check + settle invariants', async () => {
    const report = await check(indexes, {
      properties: INDEXES_PROPERTIES,
      actions: INDEXES_ACTIONS,
      episodes: 6,
      steps: 10,
      seed: 1,
      stopOnViolation: true,
    });
    expect(report.ok).toBe(true);
  }, 120_000);

  test('start boots reconciler', async () => {
    await using run = await start(indexes, {
      seed: 1,
      properties: INDEXES_PROPERTIES,
    });
    expect(await run.observe(ownedIndexCount)).toBe(0);
  }, 60_000);
});
