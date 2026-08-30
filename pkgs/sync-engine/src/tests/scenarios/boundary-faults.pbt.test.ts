import { describe, test } from 'bun:test';
import { assertDstProperty, fc } from '@pkgs/pbt';
import { acmeSetNoteOp } from '../apps/acme/domain-model';
import { acmeDstApp } from '../apps/acme/dst-app';
import type { DomainOp, DstAction, LibraryAction } from '../dst/actions';
import { HTTP_FAULTS } from '../dst/commands';
import { openWorld } from '../../sim/world';
import { arbWorldKnobs, arbWorldSeed } from '../../sim/dst/knobs';

const TRIGGER: DomainOp = acmeSetNoteOp('c0', 'n0', 'boundary');

function boundarySequence(
  arm: LibraryAction,
  trigger: DomainOp = TRIGGER
): DstAction[] {
  return [arm, trigger, { kind: 'idle', ms: 30 }, { kind: 'heal' }];
}

function crashBoundarySequence(
  arm: LibraryAction,
  trigger: DomainOp = TRIGGER
): DstAction[] {
  return [
    arm,
    trigger,
    { kind: 'restart', clientId: 'c0' },
    { kind: 'idle', ms: 20 },
    { kind: 'heal' },
  ];
}

describe('boundary faults PBT', () => {
  test(
    'HTTP fault arm then mutate converges',
    async () => {
      await assertDstProperty(
        'http fault sequences converge',
        fc.asyncProperty(
          arbWorldSeed(),
          arbWorldKnobs(),
          fc.constantFrom(...HTTP_FAULTS),
          async (seed, knobs, fault) => {
            const arm: LibraryAction = {
              kind: 'armHttpFault',
              clientId: 'c0',
              fault,
            };
            await using world = await openWorld({
              app: acmeDstApp,
              seed,
              knobs,
            });
              await world.playActions(boundarySequence(arm)
              );
              await world.assertConverged();
          }
        ),
        { numRuns: 8 }
      );
    },
    { timeout: 120_000 }
  );

  test(
    'publishFault then mutate converges',
    async () => {
      await assertDstProperty(
        'publish fault sequences converge',
        fc.asyncProperty(
          arbWorldSeed(),
          arbWorldKnobs(),
          fc.constantFrom(1, 2, 'next' as const),
          async (seed, knobs, count) => {
            const arm: LibraryAction = { kind: 'publishFault', count };
            await using world = await openWorld({
              app: acmeDstApp,
              seed,
              knobs,
            });
              await world.playActions(boundarySequence(arm)
              );
              await world.assertConverged();
          }
        ),
        { numRuns: 6 }
      );
    },
    { timeout: 90_000 }
  );

  test(
    'crash arm then mutate converges',
    async () => {
      await assertDstProperty(
        'crash arm sequences converge',
        fc.asyncProperty(
          arbWorldSeed(),
          fc.record({
            rowImageFanout: fc.boolean(),
            liveResendOnReconnect: fc.boolean(),
            bufferOutboundLive: fc.boolean(),
            clientCount: fc.constant(1),
          }),
          fc.constantFrom(
            'afterNextMutateResolved' as const,
            'afterNextMutationsPostAccepted' as const
          ),
          async (seed, knobs, event) => {
            const arm: LibraryAction = {
              kind: 'armCrashAt',
              clientId: 'c0',
              event,
            };
            await using world = await openWorld({
              app: acmeDstApp,
              seed,
              knobs,
            });
              await world.playActions(crashBoundarySequence(arm)
              );
              await world.assertConverged();
          }
        ),
        { numRuns: 6 }
      );
    },
    { timeout: 120_000 }
  );
});
