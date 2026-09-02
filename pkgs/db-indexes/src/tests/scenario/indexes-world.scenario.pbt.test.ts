import { describe, expect, test } from 'bun:test';
import { replay, runScenario } from '@pkgs/dst/pbt';
import { INDEXES_SYSTEM } from './system';

describe('indexes-world system PBT', () => {
  test('runScenario + settle invariants', async () => {
    await runScenario(
      INDEXES_SYSTEM as unknown as Parameters<typeof runScenario>[0],
      {
        maxCommands: 10,
        numRuns: 6,
      }
    );
  }, 120_000);

  test('replay empty scenario pins', async () => {
    const { world } = await replay(
      INDEXES_SYSTEM as unknown as Parameters<typeof replay>[0],
      {
        seed: 1,
        knobs: {},
        commands: [],
      }
    );
    try {
      expect(world.nodes['reconciler']).toBeDefined();
    } finally {
      await world.dispose();
    }
  }, 60_000);
});
