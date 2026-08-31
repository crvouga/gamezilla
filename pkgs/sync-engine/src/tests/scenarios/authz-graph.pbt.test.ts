import { describe, expect, test } from 'bun:test';
import { assertDstProperty, fc } from '@pkgs/pbt';
import { arbWorldKnobs, arbWorldSeed } from '../../sim/dst/knobs';
import { openWorld } from '../../sim/world';
import { expectLiveNote, readLiveNotes } from '../apps/acme/assert';
import { acmeDstApp } from '../apps/acme/dst-app';
import { deleteNote, setNote } from '../apps/acme/shared/mutations';

describe('authz graph PBT', () => {
  test(
    'non-owner delete cannot remove owner note from live set',
    async () => {
      await assertDstProperty(
        'non-owner delete rejected',
        fc.asyncProperty(
          arbWorldSeed(),
          arbWorldKnobs(),
          fc.constantFrom('n0', 'n1'),
          fc.string({ maxLength: 12 }),
          async (seed, knobs, noteId, body) => {
            if (knobs.clientCount < 2) return;
            await using world = await openWorld({
              app: acmeDstApp,
              seed,
              knobs,
            });
            const owner = world.clientIds[0]!;
            const peer = world.clientIds[1]!;
            const ownerClient = world.clients.get(owner)!;
            const peerClient = world.clients.get(peer)!;

            await ownerClient.mutate(setNote, {
              id: noteId,
              body,
              title: '',
            });
            await world.assertConverged();

            const denied = await peerClient.mutate(deleteNote, {
              id: noteId,
            });
            if (denied.ok) {
              throw new Error('non-owner delete unexpectedly succeeded');
            }
            expect(denied.failures.some((f) => f.code === 'FORBIDDEN')).toBe(
              true
            );

            await world.assertConverged();
            await expectLiveNote(ownerClient.db, noteId, { body });
            await expectLiveNote(peerClient.db, noteId, { body });
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
      await assertDstProperty(
        'multi-client authorized converge',
        fc.asyncProperty(
          arbWorldSeed(),
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
            await using world = await openWorld({
              app: acmeDstApp,
              seed,
              knobs,
            });
            for (const w of writes) {
              const client = world.clients.get('c0')!;
              await client.mutate(setNote, {
                id: w.noteId,
                body: w.body,
                title: '',
              });
            }
            await world.assertConverged();
            const serverNotes = await readLiveNotes(world.server.db);
            for (const client of world.clients.values()) {
              const local = await readLiveNotes(client.db);
              expect(local).toEqual([...serverNotes]);
            }
          }
        ),
        { numRuns: 6 }
      );
    },
    { timeout: 90_000 }
  );
});
