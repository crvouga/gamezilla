import { describe, test } from 'bun:test';
import { assertDstProperty, fc } from '@pkgs/pbt';

import type { DstAction, LibraryAction } from '../dst/actions';
import { acmeSetNoteOp } from '../apps/acme/domain-model';
import { acmeDstApp } from '../apps/acme/dst-app';
import { CORRUPTION_VARIANTS, HTTP_FAULTS, PUBSUB_FAULTS, STORAGE_TAMPERS, replayActionsOnWorld } from '../dst/commands';
import {
  arbWorldKnobs,
  arbWorldSeed,
  openPbtWorld,
} from '../dst/world-config';

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
          fc.constantFrom(...HTTP_FAULTS).filter(
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
            const opened = await openPbtWorld({
              app: acmeDstApp,
              seed,
              knobs,
            });
            try {
              await replayActionsOnWorld(
                acmeDstApp,
                opened.world,
                corruptionSequence(arm)
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
    'pubsub corruption then mutate converges',
    async () => {
      await assertDstProperty(
        'pubsub corruption sequences converge',
        fc.asyncProperty(
          arbWorldSeed(),
          arbWorldKnobs(),
          fc.constantFrom(...PUBSUB_FAULTS).filter(
            (f) => f.kind === 'corruptPubsubPayload'
          ),
          fc.constantFrom(...CORRUPTION_VARIANTS),
          async (seed, knobs, _fault, variant) => {
            const arm: LibraryAction = {
              kind: 'armPubsubFault',
              fault: { kind: 'corruptPubsubPayload', variant },
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
                corruptionSequence(arm)
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
    'local storage tamper then restart converges',
    async () => {
      await assertDstProperty(
        'storage tamper sequences converge',
        fc.asyncProperty(
          arbWorldSeed(),
          arbWorldKnobs(),
          fc.constantFrom(...STORAGE_TAMPERS),
          async (seed, knobs, tamper) => {
            const opened = await openPbtWorld({
              app: acmeDstApp,
              seed,
              knobs,
            });
            try {
              await replayActionsOnWorld(acmeDstApp, opened.world, [
                TRIGGER,
                { kind: 'tamperLocalStorage', clientId: 'c0', tamper },
                { kind: 'restart', clientId: 'c0' },
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
