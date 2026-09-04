import { describe, test } from 'bun:test';
import { fc } from '@pkgs/pbt';

import {
  arbRoomArgs,
  arbSeed,
  NET_FAULT_PROFILES,
  type RoomSystemAction,
} from '../../sim/scenario';
import { counterSystem } from '../apps/counter/system';
import { playRoomPin } from '../scenario/play-actions';

const INCREMENT_C0: RoomSystemAction = {
  kind: 'domain',
  clientId: 'c0',
  command: 'increment',
  args: {},
};

describe('room net-faults PBT', () => {
  test(
    'hold then mutate then heal converges',
    async () => {
      await fc.assert(
        fc.asyncProperty(arbSeed(), arbRoomArgs(), async (seed, args) => {
          await playRoomPin(counterSystem, {
            seed,
            knobs,
            actions: [
              { kind: 'hold', clientId: 'c1' },
              INCREMENT_C0,
              { kind: 'idle', ms: 30 },
              { kind: 'heal' },
            ],
          });
        }),
        { numRuns: 8 }
      );
    },
    { timeout: 120_000 }
  );

  test(
    'down then mutate then heal converges',
    async () => {
      await fc.assert(
        fc.asyncProperty(arbSeed(), arbRoomArgs(), async (seed, args) => {
          await playRoomPin(counterSystem, {
            seed,
            knobs,
            actions: [
              { kind: 'down', clientId: 'c1' },
              INCREMENT_C0,
              { kind: 'idle', ms: 20 },
              { kind: 'heal' },
            ],
          });
        }),
        { numRuns: 8 }
      );
    },
    { timeout: 120_000 }
  );

  test(
    'asymmetric link then mutate converges',
    async () => {
      await fc.assert(
        fc.asyncProperty(arbSeed(), arbRoomArgs(), async (seed, args) => {
          await playRoomPin(counterSystem, {
            seed,
            knobs,
            actions: [
              {
                kind: 'asymmetricLink',
                clientId: 'c1',
                link: { toClient: 'hold', toServer: 'ok' },
              },
              INCREMENT_C0,
              {
                kind: 'domain',
                clientId: 'c1',
                command: 'increment',
                args: {},
              },
              { kind: 'idle', ms: 20 },
              { kind: 'heal' },
            ],
          });
        }),
        { numRuns: 8 }
      );
    },
    { timeout: 120_000 }
  );

  test(
    'each NET_FAULT_PROFILES arm then mutate converges',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          arbSeed(),
          arbRoomArgs(),
          fc.constantFrom(...NET_FAULT_PROFILES),
          async (seed, knobs, faults) => {
            await playRoomPin(counterSystem, {
              seed,
              knobs,
              actions: [
                { kind: 'setFaults', clientId: 'c0', faults },
                { kind: 'setFaults', clientId: 'c1', faults },
                INCREMENT_C0,
                {
                  kind: 'domain',
                  clientId: 'c1',
                  command: 'decrement',
                  args: {},
                },
                { kind: 'idle', ms: 40 },
                { kind: 'heal' },
              ],
            });
          }
        ),
        { numRuns: 8 }
      );
    },
    { timeout: 120_000 }
  );
});
