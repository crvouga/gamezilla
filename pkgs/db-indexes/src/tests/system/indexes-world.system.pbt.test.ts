import { describe, expect, test } from 'bun:test';
import { assertSample, replay } from '@pkgs/determinism/pbt';
import { INDEXES_SYSTEM } from './system';

describe('indexes-world system PBT', () => {
  test(
    'assertSample + settle invariants',
    async () => {
      await assertSample(INDEXES_SYSTEM, {
        maxCommands: 10,
        numRuns: 6,
      });
    },
    120_000
  );

  test(
    'replay empty scenario pins',
    async () => {
      const { world } = await replay(INDEXES_SYSTEM, {
        seed: 1,
        knobs: {},
        actions: [],
      });
      try {
        expect(world.state.db).toBeDefined();
      } finally {
        await world.dispose();
      }
    },
    60_000
  );
});
