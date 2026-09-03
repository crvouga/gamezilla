import { describe, test } from 'bun:test';
import { assertProperty, fc } from '@pkgs/pbt';
import {
  CORRUPTION_VARIANTS,
  HTTP_FAULTS,
  PUBSUB_FAULTS,
  STORAGE_TAMPERS,
} from '../../sim/scenario';
import { arbKnobs, arbSeed } from '../../sim/scenario/knobs';
import { playAcmePin } from '../apps/acme';
import { acmeSetNoteOp } from '../apps/acme/domain-model';
import type { LibraryAction, SyncAction } from '../scenario/actions';

const TRIGGER = acmeSetNoteOp('c0', 'n0', 'corruption');

function corruptionSequence(arm: LibraryAction): SyncAction[] {
  return [arm, TRIGGER, { kind: 'idle', ms: 40 }, { kind: 'heal' }];
}

describe('corruption safety PBT', () => {
  test(
    'HTTP response corruption then mutate converges',
    async () => {
      await assertProperty(
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
            await playAcmePin({
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
      await assertProperty(
        'pubsub corruption sequences converge',
        fc.asyncProperty(
          arbSeed(),
          arbKnobs(),
          fc
            .constantFrom(...PUBSUB_FAULTS)
            .filter((f) => f.kind === 'corruptPubsubPayload'),
          fc.constantFrom(...CORRUPTION_VARIANTS),
          async (seed, knobs, _fault, variant) => {
            await playAcmePin({
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
      await assertProperty(
        'storage tamper sequences converge',
        fc.asyncProperty(
          arbSeed(),
          arbKnobs(),
          fc.constantFrom(...STORAGE_TAMPERS),
          async (seed, knobs, tamper) => {
            await playAcmePin({
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
