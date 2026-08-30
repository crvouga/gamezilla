import { describe, test } from 'bun:test';
import { assertDstProperty, fc } from '@pkgs/pbt';
import { acmeSetNoteOp } from '../apps/acme/domain-model';
import { acmeDstApp } from '../apps/acme/dst-app';
import type { DstAction, LibraryAction } from '../dst/actions';
import { SCHEMA_VARIANTS } from '../dst/commands';
import { openWorld } from '../../sim/world';
import { arbWorldKnobs, arbWorldSeed } from '../../sim/dst/knobs';

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
            const arm: LibraryAction = {
              kind: 'restartWithSchema',
              clientId: 'c0',
              variant,
            };
            await using world = await openWorld({
              app: acmeDstApp,
              seed,
              knobs,
            });
              await world.playActions(schemaSequence(arm));
              await world.assertConverged();
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
            const actions: DstAction[] = [
              {
                kind: 'restartWithSchema',
                clientId: 'c0',
                variant,
              },
              TRIGGER,
              TRIGGER_C1,
              { kind: 'idle', ms: 40 },
              { kind: 'heal' },
            ];
            await using world = await openWorld({
              app: acmeDstApp,
              seed,
              knobs: { ...knobs, clientCount: 2 },
            });
              await world.playActions(actions);
              await world.assertConverged();
          }
        ),
        { numRuns: 6 }
      );
    },
    { timeout: 120_000 }
  );

  test('extraColumn then extraTable remigrate converges (PBT shrink)', async () => {
    await using world = await openWorld({
      app: acmeDstApp,
      seed: 287086,
      knobs: {
        rowImageFanout: false,
        liveResendOnReconnect: true,
        bufferOutboundLive: true,
        clientCount: 2,
      },
    });
      await world.playActions([
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
      ]);
      await world.assertConverged();
  });

  test('mixed extraColumn without row images converges (PBT shrink)', async () => {
    await using world = await openWorld({
      app: acmeDstApp,
      seed: 1,
      knobs: {
        rowImageFanout: false,
        liveResendOnReconnect: false,
        bufferOutboundLive: false,
        clientCount: 2,
      },
    });
      await world.playActions([
        {
          kind: 'restartWithSchema',
          clientId: 'c0',
          variant: 'extraColumn',
        },
        TRIGGER,
        TRIGGER_C1,
        { kind: 'idle', ms: 40 },
        { kind: 'heal' },
      ]);
      await world.assertConverged();
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
            const actions: DstAction[] = [
              TRIGGER,
              { kind: 'protocolCut', clientId: 'c0' },
              { kind: 'idle', ms: 20 },
              { kind: 'auth', clientId: 'c0', status: 'valid' },
              { kind: 'heal' },
            ];
            await using world = await openWorld({
              app: acmeDstApp,
              seed,
              knobs,
            });
              await world.playActions(actions);
              await world.assertConverged();
          }
        ),
        { numRuns: 6 }
      );
    },
    { timeout: 120_000 }
  );
});
