import { describe, test } from 'bun:test';
import { runProperty } from '@pkgs/dst/pbt';
import { fc } from '@pkgs/pbt';
import {
  CORRUPTION_VARIANTS,
  HTTP_FAULTS,
  PUBSUB_FAULTS,
  replaySyncPin,
  STORAGE_TAMPERS,
} from '../../sim/scenario';
import { arbKnobs, arbSeed } from '../../sim/scenario/knobs';
import { acmeSetNoteOp } from '../apps/acme/domain-model';
import { acmeSystem } from '../apps/acme/system';
import type { LibraryAction, SyncAction } from '../scenario/actions';

const TRIGGER = acmeSetNoteOp('c0', 'n0', 'corruption');

function corruptionSequence(arm: LibraryAction): SyncAction[] {
  return [arm, TRIGGER, { kind: 'idle', ms: 40 }, { kind: 'heal' }];
}

describe('corruption safety PBT', () => {
  test(
    'HTTP response corruption then mutate converges',
    async () => {
      await runProperty(
        'http corruption sequences converge',
        fc.asyncProperty(
          arbSeed(),
          arbKnobs(),
          fc
            .constantFrom(...HTTP_FAULTS)
            .filter(
              (f) =>
                f.kind === 'corruptMutationsResponse' ||
                f.kind === 'corruptQueryResponse'
            ),
          async (seed, knobs, fault) => {
            await replaySyncPin(acmeSystem, {
              seed,
              knobs,
              actions: corruptionSequence({
                kind: 'armHttpFault',
                clientId: 'c0',
                fault,
              }),
            });
          }
        ),
        { numRuns: 6 }
      );
    },
    { timeout: 120_000 }
  );

  test(
    'pubsub corruption then mutate converges',
    async () => {
      await runProperty(
        'pubsub corruption sequences converge',
        fc.asyncProperty(
          arbSeed(),
          arbKnobs(),
          fc
            .constantFrom(...PUBSUB_FAULTS)
            .filter((f) => f.kind === 'corruptPubsubPayload'),
          fc.constantFrom(...CORRUPTION_VARIANTS),
          async (seed, knobs, _fault, variant) => {
            await replaySyncPin(acmeSystem, {
              seed,
              knobs,
              actions: corruptionSequence({
                kind: 'armPubsubFault',
                fault: { kind: 'corruptPubsubPayload', variant },
              }),
            });
          }
        ),
        { numRuns: 6 }
      );
    },
    { timeout: 120_000 }
  );

  test(
    'local storage tamper then restart converges',
    async () => {
      await runProperty(
        'storage tamper sequences converge',
        fc.asyncProperty(
          arbSeed(),
          arbKnobs(),
          fc.constantFrom(...STORAGE_TAMPERS),
          async (seed, knobs, tamper) => {
            await replaySyncPin(acmeSystem, {
              seed,
              knobs,
              actions: [
                TRIGGER,
                { kind: 'tamperLocalStorage', clientId: 'c0', tamper },
                { kind: 'restart', clientId: 'c0' },
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
