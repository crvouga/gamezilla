import { describe, test } from 'bun:test';
import { assertDstProperty } from '@pkgs/dst/pbt';
import { fc } from '@pkgs/pbt';
import { replaySyncPin, SCHEMA_VARIANTS } from '../../sim/dst';
import { arbWorldKnobs, arbWorldSeed } from '../../sim/dst/knobs';
import { acmeSetNoteOp } from '../apps/acme/domain-model';
import { acmeDst } from '../apps/acme/dst';
import type { DstAction, LibraryAction } from '../dst/actions';

const TRIGGER = acmeSetNoteOp('c0', 'n0', 'schema-drift');
const TRIGGER_C1 = acmeSetNoteOp('c1', 'n1', 'schema-drift-peer');

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
            await replaySyncPin(acmeDst, {
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
      await assertDstProperty(
        'mixed schema drift sequences converge',
        fc.asyncProperty(
          arbWorldSeed(),
          arbWorldKnobs(),
          fc.constantFrom('extraColumn', 'extraTable') as fc.Arbitrary<
            'extraColumn' | 'extraTable'
          >,
          async (seed, knobs, variant) => {
            await replaySyncPin(acmeDst, {
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
    await replaySyncPin(acmeDst, {
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
    await replaySyncPin(acmeDst, {
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
      await assertDstProperty(
        'protocol cut sequences converge',
        fc.asyncProperty(
          arbWorldSeed(),
          arbWorldKnobs(),
          async (seed, knobs) => {
            await replaySyncPin(acmeDst, {
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
          }
        ),
        { numRuns: 6 }
      );
    },
    { timeout: 120_000 }
  );
});
