import { describe, test } from 'bun:test';
import { assertDstProperty } from '@pkgs/dst/pbt';
import { fc } from '@pkgs/pbt';
import { HTTP_FAULTS, replaySyncPin } from '../../sim/dst';
import { arbWorldKnobs, arbWorldSeed } from '../../sim/dst/knobs';
import { acmeSetNoteOp } from '../apps/acme/domain-model';
import { acmeDst } from '../apps/acme/dst';
import type { DomainOp, DstAction, LibraryAction } from '../dst/actions';

const TRIGGER: DomainOp = acmeSetNoteOp('c0', 'n0', 'boundary');

function boundarySequence(
  arms: readonly LibraryAction[],
  trigger: DomainOp = TRIGGER
): DstAction[] {
  return [...arms, trigger, { kind: 'idle', ms: 30 }, { kind: 'heal' }];
}

function richBoundarySequence(
  arm: LibraryAction,
  trigger: DomainOp = TRIGGER
): DstAction[] {
  return [
    arm,
    { kind: 'idle', ms: 10 },
    {
      kind: 'armHttpFault',
      clientId: 'c1',
      fault: { kind: 'dropQueryResponse' },
    },
    trigger,
    { kind: 'idle', ms: 30 },
    { kind: 'heal' },
  ];
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
            await replaySyncPin(acmeDst, {
              seed,
              knobs,
              actions: richBoundarySequence({
                kind: 'armHttpFault',
                clientId: 'c0',
                fault,
              }),
            });
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
            await replaySyncPin(acmeDst, {
              seed,
              knobs,
              actions: boundarySequence([{ kind: 'publishFault', count }]),
            });
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
          }),
          fc.constantFrom(
            'afterNextMutateResolved' as const,
            'afterNextMutationsPostAccepted' as const
          ),
          async (seed, knobs, event) => {
            await replaySyncPin(acmeDst, {
              seed,
              knobs: { ...knobs, clientCount: 1 },
              actions: crashBoundarySequence({
                kind: 'armCrashAt',
                clientId: 'c0',
                event,
              }),
            });
          }
        ),
        { numRuns: 6 }
      );
    },
    { timeout: 120_000 }
  );
});
