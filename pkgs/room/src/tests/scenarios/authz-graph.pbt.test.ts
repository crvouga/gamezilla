import { describe, expect, test } from 'bun:test';
import { assertProperty, fc } from '@pkgs/pbt';

import { arbSeed } from '../../sim/scenario';
import { authzSystem } from '../apps/authz/system';
import { authzCount, authzOwner } from '../fixtures/authz-module';
import { playRoomActions } from '../scenario/play-actions';
import { readServer } from '../scenario/read-state';

describe('room authz-graph PBT', () => {
  test(
    'owner claim+bump; non-owner bump never mutates',
    async () => {
      await assertProperty(
        'authz graph converges',
        fc.asyncProperty(arbSeed(), async (seed) => {
          await using s = await playRoomActions(authzSystem, {
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
          const snap = await readServer(s);
          expect(authzOwner(snap)).toBe('c0');
          expect(authzCount(snap)).toBe(2);
        }),
        { numRuns: 8 }
      );
    },
    { timeout: 120_000 }
  );

  test('takeOver does not transfer ownership', async () => {
    await using s = await playRoomActions(authzSystem, {
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
    const snap = await readServer(s);
    expect(authzOwner(snap)).toBe('c0');
    expect(authzCount(snap)).toBe(0);
  });
});
