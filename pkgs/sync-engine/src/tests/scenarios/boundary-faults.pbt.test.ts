import { describe, test } from 'bun:test';
import { assertDstProperty, fc } from '@pkgs/pbt';

import type { DstAction, DomainOp, LibraryAction } from '../dst/actions';
import { acmeDstApp } from '../apps/acme/dst-app';
import { acmeSetNoteOp } from '../apps/acme/domain-model';
import {
  arbWorldKnobs,
  arbWorldSeed,
  openPbtWorld,
} from '../dst/world-config';
import {
  HTTP_FAULTS,
  replayActionsOnWorld,
} from '../dst/commands';

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
            const opened = await openPbtWorld({
              app: acmeDstApp,
              seed,
              knobs,
            });
            try {
              await replayActionsOnWorld(
                acmeDstApp,
                opened.world,
                boundarySequence(arm)
              );
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
            const opened = await openPbtWorld({
              app: acmeDstApp,
              seed,
              knobs,
            });
            try {
              await replayActionsOnWorld(
                acmeDstApp,
                opened.world,
                boundarySequence(arm)
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
            const opened = await openPbtWorld({
              app: acmeDstApp,
              seed,
              knobs,
            });
            try {
              await replayActionsOnWorld(
                acmeDstApp,
                opened.world,
                crashBoundarySequence(arm)
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
});
