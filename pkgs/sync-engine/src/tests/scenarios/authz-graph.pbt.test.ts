import { describe, expect, test } from 'bun:test';
import { assertProperty, fc } from '@pkgs/pbt';
import { arbSeed, arbSyncArgs } from '../../sim/scenario/args';
import {
  acmeSystem,
  clientIds,
  expectConverged,
  expectEveryClientNotesAgree,
  expectLiveNoteAt,
  lastMutationFailures,
  lastMutationOk,
  mutate,
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
          arbSyncArgs(),
          fc.constantFrom('n0', 'n1'),
          fc.string({ maxLength: 12 }),
          async (seed, syncArgs, noteId, body) => {
            if (syncArgs.clientCount < 2) return;
            await using s = await acmeSystem.script({
              seed,
              args: syncArgs,
            });

            const [owner, peer] = await s.observe(clientIds);

            await s.apply(mutate, owner!, setNote, {
              id: noteId,
              body,
              title: '',
            });
            await expectConverged(s);

            await s.apply(mutate, peer!, deleteNote, { id: noteId });
            if (await s.observe(lastMutationOk, peer!)) {
              throw new Error('non-owner delete unexpectedly succeeded');
            }
            expect(await s.observe(lastMutationFailures, peer!)).toContain(
              'FORBIDDEN'
            );

            await expectConverged(s);
            await expectLiveNoteAt(s, owner!, noteId, { body });
            await expectLiveNoteAt(s, peer!, noteId, { body });
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
          async (seed, syncArgs, writes) => {
            await using s = await acmeSystem.script({
              seed,
              args: syncArgs,
            });

            for (const w of writes) {
              await s.apply(mutate, 'c0', setNote, {
                id: w.noteId,
                body: w.body,
                title: '',
              });
            }
            await expectConverged(s);
            await expectEveryClientNotesAgree(s);
          }
        ),
        { numRuns: 6 }
      );
    },
    { timeout: 90_000 }
  );
});
