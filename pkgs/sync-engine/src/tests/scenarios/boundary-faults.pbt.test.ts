import { describe, test } from 'bun:test';
import { assertProperty, fc } from '@pkgs/pbt';
import { HTTP_FAULTS, replaySyncPin } from '../../sim/scenario';
import { arbKnobs, arbSeed } from '../../sim/scenario/knobs';
import { acmeSetNoteOp } from '../apps/acme/domain-model';
import { acmeSystem } from '../apps/acme/system';
import type { DomainOp, LibraryAction, SyncAction } from '../scenario/actions';

const TRIGGER: DomainOp = acmeSetNoteOp('c0', 'n0', 'boundary');

function boundarySequence(
  arms: readonly LibraryAction[],
  trigger: DomainOp = TRIGGER
): SyncAction[] {
  return [...arms, trigger, { kind: 'idle', ms: 30 }, { kind: 'heal' }];
}

function richBoundarySequence(
  arm: LibraryAction,
  trigger: DomainOp = TRIGGER
): SyncAction[] {
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
): SyncAction[] {
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
      await assertProperty(
        'http fault sequences converge',
        fc.asyncProperty(
          arbSeed(),
          arbKnobs(),
          fc.constantFrom(...HTTP_FAULTS),
          async (seed, knobs, fault) => {
            await replaySyncPin(acmeSystem, {
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
      await assertProperty(
        'publish fault sequences converge',
        fc.asyncProperty(
          arbSeed(),
          arbKnobs(),
          fc.constantFrom(1, 2, 'next' as const),
          async (seed, knobs, count) => {
            await replaySyncPin(acmeSystem, {
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
      await assertProperty(
        'crash arm sequences converge',
        fc.asyncProperty(
          arbSeed(),
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
            await replaySyncPin(acmeSystem, {
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
