import { describe, expect, test } from 'bun:test';
import { assertDstProperty, fc } from '@pkgs/pbt';
import { expectLiveNote, readLiveNotes } from '../apps/acme/assert';
import { acmeDstApp } from '../apps/acme/dst-app';
import { deleteNote, setNote } from '../apps/acme/shared/mutations';
import { arbWorldKnobs, arbWorldSeed, openPbtWorld } from '../dst/world-config';

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
            const opened = await openPbtWorld({
              app: acmeDstApp,
              seed,
              knobs,
            });
            try {
              const owner = opened.clientIds[0]!;
              const peer = opened.clientIds[1]!;
              const ownerClient = opened.world.clients.get(owner)!;
              const peerClient = opened.world.clients.get(peer)!;

              await ownerClient.mutate(setNote, {
                id: noteId,
                body,
                title: '',
              });
              await opened.world.assertConverged();

              const denied = await peerClient.mutate(deleteNote, {
                id: noteId,
              });
              if (denied.ok) {
                throw new Error('non-owner delete unexpectedly succeeded');
              }
              expect(denied.failures.some((f) => f.code === 'FORBIDDEN')).toBe(
                true
              );

              await opened.world.assertConverged();
              await expectLiveNote(ownerClient.db, noteId, { body });
              await expectLiveNote(peerClient.db, noteId, { body });
            } finally {
              await opened.world.dispose();
            }
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
            const opened = await openPbtWorld({
              app: acmeDstApp,
              seed,
              knobs,
            });
            try {
              for (const w of writes) {
                const client = opened.world.clients.get('c0')!;
                await client.mutate(setNote, {
                  id: w.noteId,
                  body: w.body,
                  title: '',
                });
              }
              await opened.world.assertConverged();
              const serverNotes = await readLiveNotes(opened.world.server.db);
              for (const client of opened.world.clients.values()) {
                const local = await readLiveNotes(client.db);
                expect(local).toEqual([...serverNotes]);
              }
            } finally {
              await opened.world.dispose();
            }
          }
        ),
        { numRuns: 6 }
      );
    },
    { timeout: 90_000 }
  );
});
