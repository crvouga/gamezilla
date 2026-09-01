import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { assertSampleProperty } from '@pkgs/determinism/pbt';
import { fc } from '@pkgs/pbt';
import { syncFacade } from '../../sim/system';
import { arbWorldKnobs, arbWorldSeed } from '../../sim/system/knobs';
import { expectLiveNote, readLiveNotes } from '../apps/acme/assert';
import { deleteNote, setNote } from '../apps/acme/shared/mutations';
import { acmeSystem } from '../apps/acme/system';

describe('authz graph PBT', () => {
  test(
    'non-owner delete cannot remove owner note from live set',
    async () => {
      await assertSampleProperty(
        'non-owner delete rejected',
        fc.asyncProperty(
          arbWorldSeed(),
          arbWorldKnobs(),
          fc.constantFrom('n0', 'n1'),
          fc.string({ maxLength: 12 }),
          async (seed, knobs, noteId, body) => {
            if (knobs.clientCount < 2) return;
            await using world = await openWorld(acmeSystem, { seed, knobs });
            const facade = syncFacade(world.system);
            const [owner, peer] = world.roleIds('client');
            const ownerClient = facade.clients.get(owner!)!;
            const peerClient = facade.clients.get(peer!)!;

            await ownerClient.mutate(setNote, {
              id: noteId,
              body,
              title: '',
            });
            await facade.assertConverged();

            const denied = await peerClient.mutate(deleteNote, {
              id: noteId,
            });
            if (denied.ok) {
              throw new Error('non-owner delete unexpectedly succeeded');
            }
            expect(denied.failures.some((f) => f.code === 'FORBIDDEN')).toBe(
              true
            );

            await facade.assertConverged();
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
      await assertSampleProperty(
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
            await using world = await openWorld(acmeSystem, { seed, knobs });
            const facade = syncFacade(world.system);
            for (const w of writes) {
              const client = facade.clients.get('c0')!;
              await client.mutate(setNote, {
                id: w.noteId,
                body: w.body,
                title: '',
              });
            }
            await facade.assertConverged();
            const serverNotes = await readLiveNotes(facade.server.db);
            for (const client of facade.clients.values()) {
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
