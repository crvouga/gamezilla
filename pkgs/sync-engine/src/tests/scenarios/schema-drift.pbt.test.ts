import { describe, test } from 'bun:test';
import { assertProperty, fc } from '@pkgs/pbt';
import { SCHEMA_VARIANTS } from '../../sim/scenario';
import { arbKnobs, arbSeed } from '../../sim/scenario/knobs';
import { playAcmePin } from '../apps/acme';
import { acmeSetNoteOp } from '../apps/acme/domain-model';
import type { LibraryAction, SyncAction } from '../scenario/actions';

const TRIGGER = acmeSetNoteOp('c0', 'n0', 'schema-drift');
const TRIGGER_C1 = acmeSetNoteOp('c1', 'n1', 'schema-drift-peer');

function schemaSequence(arm: LibraryAction): SyncAction[] {
  return [arm, TRIGGER, { kind: 'idle', ms: 40 }, { kind: 'heal' }];
}

describe('schema drift PBT', () => {
  test(
    'restartWithSchema then mutate converges among healthy clients',
    async () => {
      await assertProperty(
        'schema drift sequences converge',
        fc.asyncProperty(
          arbSeed(),
          arbKnobs(),
          fc.constantFrom(...SCHEMA_VARIANTS),
          async (seed, knobs, variant) => {
            await playAcmePin({
              seed,
              knobs,
              actions: schemaSequence({
                kind: 'restartWithSchema',
                clientId: 'c0',
                variant,
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
    'mixed-schema clients both mutate then converge',
    async () => {
      await assertProperty(
        'mixed schema drift sequences converge',
        fc.asyncProperty(
          arbSeed(),
          arbKnobs(),
          fc.constantFrom('extraColumn', 'extraTable') as fc.Arbitrary<
            'extraColumn' | 'extraTable'
          >,
          async (seed, knobs, variant) => {
            await playAcmePin({
              seed,
              knobs: { ...knobs, clientCount: 2 },
              actions: [
                {
                  kind: 'restartWithSchema',
                  clientId: 'c0',
                  variant,
                },
                TRIGGER,
                TRIGGER_C1,
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

  test('extraColumn then extraTable remigrate converges (PBT shrink)', async () => {
    await playAcmePin({
      seed: 287086,
      knobs: { liveResendOnReconnect: true, bufferOutboundLive: true },
      actions: [
        {
          kind: 'restartWithSchema',
          clientId: 'c0',
          variant: 'extraColumn',
        },
        {
          kind: 'restartWithSchema',
          clientId: 'c0',
          variant: 'extraTable',
        },
        { kind: 'auth', clientId: 'c0', status: 'valid' },
      ],
    });
  });

  test('mixed extraColumn without row images converges (PBT shrink)', async () => {
    await playAcmePin({
      seed: 1,
      actions: [
        {
          kind: 'restartWithSchema',
          clientId: 'c0',
          variant: 'extraColumn',
        },
        TRIGGER,
        TRIGGER_C1,
        { kind: 'idle', ms: 40 },
        { kind: 'heal' },
      ],
    });
  });

  test(
    'protocolCut rejects without wiping then heal converges',
    async () => {
      await assertProperty(
        'protocol cut sequences converge',
        fc.asyncProperty(arbSeed(), arbKnobs(), async (seed, knobs) => {
          await playAcmePin({
            seed,
            knobs,
            actions: [
              TRIGGER,
              { kind: 'protocolCut', clientId: 'c0' },
              { kind: 'idle', ms: 20 },
              { kind: 'auth', clientId: 'c0', status: 'valid' },
              { kind: 'heal' },
            ],
          });
        }),
        { numRuns: 6 }
      );
    },
    { timeout: 120_000 }
  );
});
