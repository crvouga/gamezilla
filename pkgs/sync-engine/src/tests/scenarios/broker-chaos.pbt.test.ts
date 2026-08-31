import { describe, test } from 'bun:test';
import { assertDstProperty } from '@pkgs/dst/pbt';
import { fc } from '@pkgs/pbt';
import { PUBSUB_FAULTS, replaySyncPin } from '../../sim/dst';
import { arbWorldKnobs, arbWorldSeed } from '../../sim/dst/knobs';
import { acmeSetNoteOp } from '../apps/acme/domain-model';
import { acmeDst } from '../apps/acme/dst';
import type { DstAction, LibraryAction } from '../dst/actions';

const TRIGGER = acmeSetNoteOp('c0', 'n0', 'broker-chaos');

function brokerSequence(arm: LibraryAction): DstAction[] {
  return [arm, TRIGGER, { kind: 'idle', ms: 40 }, { kind: 'heal' }];
}

describe('broker chaos PBT', () => {
  test(
    'brokerRestart then peer faults still converges',
    async () => {
      await replaySyncPin(acmeDst, {
        seed: 1_000_000,
        knobs: {
          liveResendOnReconnect: true,
          bufferOutboundLive: true,
          clientCount: 3,
        },
        actions: [
          { kind: 'brokerRestart' },
          {
            kind: 'setFaults',
            nodeId: 'c1',
            traffic: 'all',
            faults: {
              packetLossProbability: 0.05,
              reorderWindow: 2,
              partitionProbability: 0.02,
            },
          },
        ],
      });
    },
    { timeout: 30_000 }
  );

  test(
    'pubsub fault arms then mutate converges',
    async () => {
      await assertDstProperty(
        'pubsub fault sequences converge',
        fc.asyncProperty(
          arbWorldSeed(),
          arbWorldKnobs(),
          fc.constantFrom(...PUBSUB_FAULTS),
          async (seed, knobs, fault) => {
            await replaySyncPin(acmeDst, {
              seed,
              knobs,
              actions: brokerSequence({ kind: 'armPubsubFault', fault }),
            });
          }
        ),
        { numRuns: 6 }
      );
    },
    { timeout: 120_000 }
  );

  test(
    'broker crash/restart then mutate converges',
    async () => {
      await assertDstProperty(
        'broker restart sequences converge',
        fc.asyncProperty(
          arbWorldSeed(),
          arbWorldKnobs(),
          fc.constantFrom(
            { kind: 'brokerCrash' } as const,
            { kind: 'brokerRestart' } as const
          ),
          async (seed, knobs, arm) => {
            await replaySyncPin(acmeDst, {
              seed,
              knobs,
              actions: [
                arm,
                TRIGGER,
                { kind: 'brokerRestart' },
                { kind: 'idle', ms: 40 },
                { kind: 'heal' },
              ],
            });
          }
        ),
        { numRuns: 6 }
      );
    },
    { timeout: 120_000 }
  );
});
