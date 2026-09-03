import { describe, expect, test } from 'bun:test';
import { explore, script } from '@pkgs/dst';
import {
  INDEXES_ACTIONS,
  INDEXES_PROPERTIES,
  indexes,
  ownedIndexCount,
} from './system';

describe('indexes system PBT', () => {
  test('check + settle invariants', async () => {
    const report = await explore(indexes, {
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
    await using run = await script(indexes, {
      seed: 1,
      properties: INDEXES_PROPERTIES,
    });
    expect(await run.observe(ownedIndexCount)).toBe(0);
  }, 60_000);
});
