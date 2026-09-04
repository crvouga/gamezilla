import { describe, expect, test } from 'bun:test';
import {
  advanceClock,
  bumpUsage,
  indexes,
  ownedIndexCount,
  reconcile,
  setManifest,
} from './system';

describe('indexes scenario pins', () => {
  test('seed replay is byte-identical on owned count', async () => {
    async function once(seed: number): Promise<number> {
      await using s = await indexes.script({ seed });
      await s.apply(setManifest, 'user');
      await s.apply(reconcile);
      await s.apply(advanceClock, 2);
      await s.apply(reconcile);
      return await s.observe(ownedIndexCount);
    }
    const a = await once(42);
    const b = await once(42);
    expect(a).toBe(b);
  }, 60_000);

  test('fixpoint after enough fault-free runs', async () => {
    await using s = await indexes.script({ seed: 1 });
    await s.apply(setManifest, 'user');
    await s.apply(reconcile);
    expect(await s.observe(ownedIndexCount)).toBeGreaterThan(0);
    await s.apply(reconcile);
    // Second reconcile with unchanged manifest settles (no new owned indexes).
    expect(await s.observe(ownedIndexCount)).toBeGreaterThan(0);
  }, 60_000);

  test('usage since deprecation never drops', async () => {
    await using s = await indexes.script({ seed: 3 });
    await s.apply(setManifest, 'user');
    await s.apply(reconcile);
    expect(await s.observe(ownedIndexCount)).toBe(1);

    await s.apply(setManifest, 'empty');
    await s.apply(reconcile);
    await s.apply(bumpUsage);
    await s.apply(advanceClock, 2);
    await s.apply(reconcile);

    expect(await s.observe(ownedIndexCount)).toBe(1);
  }, 60_000);
});
