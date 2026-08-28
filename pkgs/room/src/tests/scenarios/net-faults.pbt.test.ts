import { describe, test } from 'bun:test';
import { assertDstProperty, fc } from '@pkgs/pbt';

import { counterDstApp } from '../apps/counter/dst-app';
import type { RoomDstAction } from '../dst/actions';
import { NET_FAULT_PROFILES, replayActionsOnWorld } from '../dst/commands';
import { arbWorldKnobs, arbWorldSeed, openPbtWorld } from '../dst/world-config';

describe('room net-faults PBT', () => {
  test(
    'hold then mutate then heal converges',
    async () => {
      await assertDstProperty(
        'hold sequences converge',
        fc.asyncProperty(
          arbWorldSeed(),
          arbWorldKnobs(),
          async (seed, knobs) => {
            const opened = await openPbtWorld({
              app: counterDstApp,
              seed,
              knobs,
            });
            try {
              const actions: RoomDstAction[] = [
                { kind: 'hold', clientId: 'c1' },
                {
                  kind: 'domain',
                  clientId: 'c0',
                  command: 'increment',
                  args: {},
                },
                { kind: 'idle', ms: 30 },
                { kind: 'heal' },
              ];
              await replayActionsOnWorld(counterDstApp, opened.world, actions);
              await opened.world.assertConverged();
            } finally {
              await opened.world.dispose();
            }
          }
        ),
        { numRuns: 8 }
      );
    },
    { timeout: 120_000 }
  );

  test(
    'down then mutate then heal converges',
    async () => {
      await assertDstProperty(
        'down sequences converge',
        fc.asyncProperty(
          arbWorldSeed(),
          arbWorldKnobs(),
          async (seed, knobs) => {
            const opened = await openPbtWorld({
              app: counterDstApp,
              seed,
              knobs,
            });
            try {
              await replayActionsOnWorld(counterDstApp, opened.world, [
                { kind: 'down', clientId: 'c1' },
                {
                  kind: 'domain',
                  clientId: 'c0',
                  command: 'increment',
                  args: {},
                },
                { kind: 'idle', ms: 20 },
                { kind: 'heal' },
              ]);
              await opened.world.assertConverged();
            } finally {
              await opened.world.dispose();
            }
          }
        ),
        { numRuns: 8 }
      );
    },
    { timeout: 120_000 }
  );

  test(
    'asymmetric link then mutate converges',
    async () => {
      await assertDstProperty(
        'asymmetric sequences converge',
        fc.asyncProperty(
          arbWorldSeed(),
          arbWorldKnobs(),
          async (seed, knobs) => {
            const opened = await openPbtWorld({
              app: counterDstApp,
              seed,
              knobs,
            });
            try {
              await replayActionsOnWorld(counterDstApp, opened.world, [
                {
                  kind: 'asymmetricLink',
                  clientId: 'c1',
                  link: { toClient: 'hold', toServer: 'ok' },
                },
                {
                  kind: 'domain',
                  clientId: 'c0',
                  command: 'increment',
                  args: {},
                },
                {
                  kind: 'domain',
                  clientId: 'c1',
                  command: 'increment',
                  args: {},
                },
                { kind: 'idle', ms: 20 },
                { kind: 'heal' },
              ]);
              await opened.world.assertConverged();
            } finally {
              await opened.world.dispose();
            }
          }
        ),
        { numRuns: 8 }
      );
    },
    { timeout: 120_000 }
  );

  test(
    'each NET_FAULT_PROFILES arm then mutate converges',
    async () => {
      await assertDstProperty(
        'fault profile sequences converge',
        fc.asyncProperty(
          arbWorldSeed(),
          arbWorldKnobs(),
          fc.constantFrom(...NET_FAULT_PROFILES),
          async (seed, knobs, faults) => {
            const opened = await openPbtWorld({
              app: counterDstApp,
              seed,
              knobs,
            });
            try {
              await replayActionsOnWorld(counterDstApp, opened.world, [
                { kind: 'setFaults', clientId: 'c0', faults },
                { kind: 'setFaults', clientId: 'c1', faults },
                {
                  kind: 'domain',
                  clientId: 'c0',
                  command: 'increment',
                  args: {},
                },
                {
                  kind: 'domain',
                  clientId: 'c1',
                  command: 'decrement',
                  args: {},
                },
                { kind: 'idle', ms: 40 },
                { kind: 'heal' },
              ]);
              await opened.world.assertConverged();
            } finally {
              await opened.world.dispose();
            }
          }
        ),
        { numRuns: 8 }
      );
    },
    { timeout: 120_000 }
  );
});
