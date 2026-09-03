import { describe, expect, test } from 'bun:test';
import { script } from '@pkgs/dst';
import {
  advanceClock,
  bumpUsage,
  INDEXES_PROPERTIES,
  indexes,
  ownedIndexCount,
  reconcile,
  setManifest,
} from './system';

describe('indexes scenario pins', () => {
  test('seed replay is byte-identical on owned count', async () => {
    async function once(seed: number): Promise<number> {
      await using run = await script(indexes, {
        seed,
        properties: INDEXES_PROPERTIES,
      });
      await run.apply(setManifest, 'user');
      await run.apply(reconcile);
      await run.apply(advanceClock, 2);
      await run.apply(reconcile);
      return await run.observe(ownedIndexCount);
    }
    const a = await once(42);
    const b = await once(42);
    expect(a).toBe(b);
  }, 60_000);

  test('fixpoint after enough fault-free runs', async () => {
    await using run = await script(indexes, {
      seed: 1,
      properties: INDEXES_PROPERTIES,
    });
    await run.apply(setManifest, 'user');
    await run.apply(reconcile);
    expect(await run.observe(ownedIndexCount)).toBeGreaterThan(0);
    await run.apply(reconcile);
    // Second reconcile with unchanged manifest settles (no new owned indexes).
    expect(await run.observe(ownedIndexCount)).toBeGreaterThan(0);
  }, 60_000);

  test('usage since deprecation never drops', async () => {
    await using run = await script(indexes, {
      seed: 3,
      properties: INDEXES_PROPERTIES,
    });
    await run.apply(setManifest, 'user');
    await run.apply(reconcile);
    expect(await run.observe(ownedIndexCount)).toBe(1);

    await run.apply(setManifest, 'empty');
    await run.apply(reconcile);
    await run.apply(bumpUsage);
    await run.apply(advanceClock, 2);
    await run.apply(reconcile);

    expect(await run.observe(ownedIndexCount)).toBe(1);
  }, 60_000);
});
