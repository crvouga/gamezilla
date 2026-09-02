import { describe, expect, test } from 'bun:test';
import { check, replay } from '@pkgs/dst/pbt';
import { INDEXES_SYSTEM } from './system';

describe('indexes-world system PBT', () => {
  test('check + settle invariants', async () => {
    await check(INDEXES_SYSTEM as unknown as Parameters<typeof check>[0], {
      episodeLength: 10,
      episodes: 6,
    });
  }, 120_000);

  test('replay empty scenario pins', async () => {
    const { world } = await replay(
      INDEXES_SYSTEM as unknown as Parameters<typeof replay>[0],
      {
        seed: 1,
        knobs: {},
        actions: [],
      }
    );
    try {
      expect(world.nodes['reconciler']).toBeDefined();
    } finally {
      await world.dispose();
    }
  }, 60_000);
});
