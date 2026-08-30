import { describe, test } from 'bun:test';
import { assertDstProperty, fc } from '@pkgs/pbt';
import { acmeSetNoteOp } from '../apps/acme/domain-model';
import { acmeDstApp } from '../apps/acme/dst-app';
import type { DstAction, LibraryAction } from '../dst/actions';
import {
  CORRUPTION_VARIANTS,
  HTTP_FAULTS,
  PUBSUB_FAULTS,
  STORAGE_TAMPERS,
} from '../dst/commands';
import { openWorld } from '../../sim/world';
import { arbWorldKnobs, arbWorldSeed } from '../../sim/dst/knobs';

const TRIGGER = acmeSetNoteOp('c0', 'n0', 'corruption');

function corruptionSequence(arm: LibraryAction): DstAction[] {
  return [arm, TRIGGER, { kind: 'idle', ms: 40 }, { kind: 'heal' }];
}

describe('corruption safety PBT', () => {
  test(
    'HTTP response corruption then mutate converges',
    async () => {
      await assertDstProperty(
        'http corruption sequences converge',
        fc.asyncProperty(
          arbWorldSeed(),
          arbWorldKnobs(),
          fc
            .constantFrom(...HTTP_FAULTS)
            .filter(
              (f) =>
                f.kind === 'corruptMutationsResponse' ||
                f.kind === 'corruptQueryResponse'
            ),
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
              await world.playActions(corruptionSequence(arm)
              );
              await world.assertConverged();
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
      await assertDstProperty(
        'pubsub corruption sequences converge',
        fc.asyncProperty(
          arbWorldSeed(),
          arbWorldKnobs(),
          fc
            .constantFrom(...PUBSUB_FAULTS)
            .filter((f) => f.kind === 'corruptPubsubPayload'),
          fc.constantFrom(...CORRUPTION_VARIANTS),
          async (seed, knobs, _fault, variant) => {
            const arm: LibraryAction = {
              kind: 'armPubsubFault',
              fault: { kind: 'corruptPubsubPayload', variant },
            };
            await using world = await openWorld({
              app: acmeDstApp,
              seed,
              knobs,
            });
              await world.playActions(corruptionSequence(arm)
              );
              await world.assertConverged();
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
      await assertDstProperty(
        'storage tamper sequences converge',
        fc.asyncProperty(
          arbWorldSeed(),
          arbWorldKnobs(),
          fc.constantFrom(...STORAGE_TAMPERS),
          async (seed, knobs, tamper) => {
            await using world = await openWorld({
              app: acmeDstApp,
              seed,
              knobs,
            });
              await world.playActions([
                TRIGGER,
                { kind: 'tamperLocalStorage', clientId: 'c0', tamper },
                { kind: 'restart', clientId: 'c0' },
                { kind: 'idle', ms: 40 },
                { kind: 'heal' },
              ]);
              await world.assertConverged();
          }
        ),
        { numRuns: 6 }
      );
    },
    { timeout: 120_000 }
  );
});
