import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import { assertProperty, fc } from '@pkgs/pbt';
import { arbKnobs, arbSeed } from '../../sim/scenario/knobs';
import {
  acmeDraws,
  acmeSystem,
  assertConverged,
  clientIds,
  expectEveryClientNotesAgree,
  expectLiveNoteAt,
  lastMutationFailures,
  lastMutationOk,
  mutate,
  syncVirtualHost,
} from '../apps/acme';
import { deleteNote, setNote } from '../apps/acme/shared/mutations';

describe('authz graph PBT', () => {
  test(
    'non-owner delete cannot remove owner note from live set',
    async () => {
      await assertProperty(
        'non-owner delete rejected',
        fc.asyncProperty(
          arbSeed(),
          arbKnobs(),
          fc.constantFrom('n0', 'n1'),
          fc.string({ maxLength: 12 }),
          async (seed, knobs, noteId, body) => {
            if (knobs.clientCount < 2) return;
            await using run = await start(acmeSystem, {
              seed,
              host: syncVirtualHost(),
              draws: acmeDraws(knobs),
              properties: [],
            });

            const [owner, peer] = await run.observe(clientIds);

            await run.apply(mutate, owner!, setNote, {
              id: noteId,
              body,
              title: '',
            });
            await run.apply(assertConverged);

            await run.apply(mutate, peer!, deleteNote, { id: noteId });
            if (await run.observe(lastMutationOk(peer!))) {
              throw new Error('non-owner delete unexpectedly succeeded');
            }
            expect(await run.observe(lastMutationFailures(peer!))).toContain(
              'FORBIDDEN'
            );

            await run.apply(assertConverged);
            await expectLiveNoteAt(run, owner!, noteId, { body });
            await expectLiveNoteAt(run, peer!, noteId, { body });
          }
        ),
        { numRuns: 8 }
      );
    },
    { timeout: 90_000 }
  );

  test(
    'authorized mutates from multiple clients converge to one live row set',
    async () => {
      await assertProperty(
        'multi-client authorized converge',
        fc.asyncProperty(
          arbSeed(),
          fc.record({
            rowImageFanout: fc.boolean(),
            liveResendOnReconnect: fc.boolean(),
            bufferOutboundLive: fc.boolean(),
            clientCount: fc.constant(2),
          }),
          fc.array(
            fc.record({
              noteId: fc.constantFrom('n0', 'n1'),
              body: fc.string({ maxLength: 10 }),
            }),
            { minLength: 1, maxLength: 6 }
          ),
          async (seed, knobs, writes) => {
            await using run = await start(acmeSystem, {
              seed,
              host: syncVirtualHost(),
              draws: acmeDraws(knobs),
              properties: [],
            });

            for (const w of writes) {
              await run.apply(mutate, 'c0', setNote, {
                id: w.noteId,
                body: w.body,
                title: '',
              });
            }
            await run.apply(assertConverged);
            await expectEveryClientNotesAgree(run);
          }
        ),
        { numRuns: 6 }
      );
    },
    { timeout: 90_000 }
  );
});
