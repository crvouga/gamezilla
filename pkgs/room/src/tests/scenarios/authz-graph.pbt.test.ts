import { describe, expect, test } from 'bun:test';
import { arbWorldSeed, assertSampleProperty } from '@pkgs/determinism/pbt';
import { fc } from '@pkgs/pbt';

import { replayRoom } from '../../sim/system';
import { authzSystem } from '../apps/authz/system';
import { authzCount, authzOwner } from '../fixtures/authz-module';

async function expectAuthzState(
  world: Awaited<ReturnType<typeof replayRoom>>,
  expected: { readonly owner: string; readonly count: number }
): Promise<void> {
  try {
    const snap = await world.facade.serverSnapshot();
    expect(authzOwner(snap)).toBe(expected.owner);
    expect(authzCount(snap)).toBe(expected.count);
  } finally {
    await world.dispose();
  }
}

describe('room authz-graph PBT', () => {
  test(
    'owner claim+bump; non-owner bump never mutates',
    async () => {
      await assertSampleProperty(
        'authz graph converges',
        fc.asyncProperty(arbWorldSeed(), async (seed) => {
          const world = await replayRoom(authzSystem, {
            seed,
            actions: [
              {
                kind: 'domain',
                clientId: 'c0',
                command: 'claim',
                args: {},
              },
              { kind: 'idle', ms: 10 },
              {
                kind: 'domain',
                clientId: 'c1',
                command: 'bump',
                args: {},
              },
              {
                kind: 'domain',
                clientId: 'c0',
                command: 'bump',
                args: {},
              },
              { kind: 'disconnect', clientId: 'c0' },
              { kind: 'connect', clientId: 'c0' },
              {
                kind: 'domain',
                clientId: 'c0',
                command: 'bump',
                args: {},
              },
            ],
          });
          await expectAuthzState(world, { owner: 'c0', count: 2 });
        }),
        { numRuns: 8 }
      );
    },
    { timeout: 120_000 }
  );

  test('takeOver does not transfer ownership', async () => {
    const world = await replayRoom(authzSystem, {
      seed: 21,
      actions: [
        {
          kind: 'domain',
          clientId: 'c0',
          command: 'claim',
          args: {},
        },
        { kind: 'takeOver', clientId: 'c1' },
        {
          kind: 'domain',
          clientId: 'c1',
          command: 'bump',
          args: {},
        },
      ],
    });
    await expectAuthzState(world, { owner: 'c0', count: 0 });
  });
});
