import { describe, test } from 'bun:test';
import { assertDstProperty, fc } from '@pkgs/pbt';

import type { DstAction, LibraryAction } from '../dst/actions';
import { acmeSetNoteOp } from '../apps/acme/domain-model';
import { acmeDstApp } from '../apps/acme/dst-app';
import { SCHEMA_VARIANTS, replayActionsOnWorld } from '../dst/commands';
import {
  arbWorldKnobs,
  arbWorldSeed,
  openPbtWorld,
} from '../dst/world-config';

const TRIGGER = acmeSetNoteOp('c0', 'n0', 'schema-drift');

function schemaSequence(arm: LibraryAction): DstAction[] {
  return [arm, TRIGGER, { kind: 'idle', ms: 40 }, { kind: 'heal' }];
}

describe('schema drift PBT', () => {
  test(
    'restartWithSchema then mutate converges among healthy clients',
    async () => {
      await assertDstProperty(
        'schema drift sequences converge',
        fc.asyncProperty(
          arbWorldSeed(),
          arbWorldKnobs(),
          fc.constantFrom(...SCHEMA_VARIANTS),
          async (seed, knobs, variant) => {
            const arm: LibraryAction = {
              kind: 'restartWithSchema',
              clientId: 'c0',
              variant,
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
                schemaSequence(arm)
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
    'protocolCut rejects without wiping then heal converges',
    async () => {
      await assertDstProperty(
        'protocol cut sequences converge',
        fc.asyncProperty(arbWorldSeed(), arbWorldKnobs(), async (seed, knobs) => {
          const actions: DstAction[] = [
            TRIGGER,
            { kind: 'protocolCut', clientId: 'c0' },
            { kind: 'idle', ms: 20 },
            { kind: 'auth', clientId: 'c0', status: 'valid' },
            { kind: 'heal' },
          ];
          const opened = await openPbtWorld({
            app: acmeDstApp,
            seed,
            knobs,
          });
          try {
            await replayActionsOnWorld(acmeDstApp, opened.world, actions);
            await opened.world.assertConverged();
          } finally {
            await opened.world.dispose();
          }
        }),
        { numRuns: 6 }
      );
    },
    { timeout: 120_000 }
  );
});
