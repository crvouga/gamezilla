import { describe, test } from 'bun:test';
import { assertProperty, fc } from '@pkgs/pbt';
import { PUBSUB_FAULTS } from '../../sim/scenario';
import { arbKnobs, arbSeed } from '../../sim/scenario/knobs';
import { playAcmePin } from '../apps/acme';
import { acmeSetNoteOp } from '../apps/acme/domain-model';
import type { LibraryAction, SyncAction } from '../scenario/actions';

const TRIGGER = acmeSetNoteOp('c0', 'n0', 'broker-chaos');

function brokerSequence(arm: LibraryAction): SyncAction[] {
  return [arm, TRIGGER, { kind: 'idle', ms: 40 }, { kind: 'heal' }];
}

describe('broker chaos PBT', () => {
  test(
    'brokerRestart then peer faults still converges',
    async () => {
      await playAcmePin({
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
              dropProbability: 0.05,
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
      await assertProperty(
        'pubsub fault sequences converge',
        fc.asyncProperty(
          arbSeed(),
          arbKnobs(),
          fc.constantFrom(...PUBSUB_FAULTS),
          async (seed, knobs, fault) => {
            await playAcmePin({
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
      await assertProperty(
        'broker restart sequences converge',
        fc.asyncProperty(
          arbSeed(),
          arbKnobs(),
          fc.constantFrom(
            { kind: 'brokerCrash' } as const,
            { kind: 'brokerRestart' } as const
          ),
          async (seed, knobs, arm) => {
            await playAcmePin({
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
