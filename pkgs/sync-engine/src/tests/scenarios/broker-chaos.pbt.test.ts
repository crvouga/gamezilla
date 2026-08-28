import { describe, test } from 'bun:test';
import { assertDstProperty, fc } from '@pkgs/pbt';
import { acmeSetNoteOp } from '../apps/acme/domain-model';
import { acmeDstApp } from '../apps/acme/dst-app';
import type { DstAction, LibraryAction } from '../dst/actions';
import { PUBSUB_FAULTS, replayActionsOnWorld } from '../dst/commands';
import { arbWorldKnobs, arbWorldSeed, openPbtWorld } from '../dst/world-config';

const TRIGGER = acmeSetNoteOp('c0', 'n0', 'broker-chaos');

function brokerSequence(arm: LibraryAction): DstAction[] {
  return [arm, TRIGGER, { kind: 'idle', ms: 40 }, { kind: 'heal' }];
}

describe('broker chaos PBT', () => {
  test(
    'brokerRestart then peer faults still converges',
    async () => {
      const opened = await openPbtWorld({
        app: acmeDstApp,
        seed: 1_000_000,
        knobs: {
          rowImageFanout: false,
          liveResendOnReconnect: true,
          bufferOutboundLive: true,
          clientCount: 3,
        },
      });
      try {
        await replayActionsOnWorld(acmeDstApp, opened.world, [
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
        ]);
        await opened.world.assertConverged();
      } finally {
        await opened.world.dispose();
      }
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
            const arm: LibraryAction = { kind: 'armPubsubFault', fault };
            const opened = await openPbtWorld({
              app: acmeDstApp,
              seed,
              knobs,
            });
            try {
              await replayActionsOnWorld(
                acmeDstApp,
                opened.world,
                brokerSequence(arm)
              );
              await opened.world.assertConverged();
            } finally {
              await opened.world.dispose();
            }
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
            const opened = await openPbtWorld({
              app: acmeDstApp,
              seed,
              knobs,
            });
            try {
              await replayActionsOnWorld(acmeDstApp, opened.world, [
                arm,
                TRIGGER,
                { kind: 'brokerRestart' },
                { kind: 'idle', ms: 40 },
                { kind: 'heal' },
              ]);
              await opened.world.assertConverged();
            } finally {
              await opened.world.dispose();
            }
          }
        ),
        { numRuns: 6 }
      );
    },
    { timeout: 120_000 }
  );
});
