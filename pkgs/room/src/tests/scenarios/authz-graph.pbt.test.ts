import { describe, expect, test } from 'bun:test';
import { assertDstProperty, fc } from '@pkgs/pbt';

import { authzDstApp } from '../apps/authz/dst-app';
import { replayActionsOnWorld } from '../dst/commands';
import { arbWorldSeed, openPbtWorld } from '../dst/world-config';
import { authzCount, authzOwner } from '../fixtures/authz-module';

describe('room authz-graph PBT', () => {
  test(
    'owner claim+bump; non-owner bump never mutates',
    async () => {
      await assertDstProperty(
        'authz graph converges',
        fc.asyncProperty(arbWorldSeed(), async (seed) => {
          const opened = await openPbtWorld({
            app: authzDstApp,
            seed,
            knobs: { clientCount: 2, mildFaults: false },
          });
          try {
            await replayActionsOnWorld(authzDstApp, opened.world, [
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
            ]);
            await opened.world.assertConverged();
            const snap = await opened.world.serverSnapshot();
            expect(authzOwner(snap)).toBe('c0');
            expect(authzCount(snap)).toBe(2);
          } finally {
            await opened.world.dispose();
          }
        }),
        { numRuns: 8 }
      );
    },
    { timeout: 120_000 }
  );

  test('takeOver does not transfer ownership', async () => {
    const opened = await openPbtWorld({
      app: authzDstApp,
      seed: 21,
      knobs: { clientCount: 2, mildFaults: false },
    });
    try {
      await replayActionsOnWorld(authzDstApp, opened.world, [
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
      ]);
      await opened.world.assertConverged();
      const snap = await opened.world.serverSnapshot();
      expect(authzOwner(snap)).toBe('c0');
      expect(authzCount(snap)).toBe(0);
    } finally {
      await opened.world.dispose();
    }
  });
});
