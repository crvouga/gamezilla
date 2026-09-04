import { describe, expect, test } from 'bun:test';
import { defineAction } from '@pkgs/dst';
import { gen } from '@pkgs/dst/fast-check';
import fc from 'fast-check';

import {
  acmeSystem,
  clientIds,
  expectConverged,
  expectEveryClientNotesAgree,
  expectLiveNoteAt,
  lastMutationFailures,
  lastMutationOk,
  mutate,
  type SyncSurface,
  setNote,
} from '../apps/acme';
import { deleteNote } from '../apps/acme/shared/mutations';

/** c0 writes one of two notes with a short body — the authorized-writer slice. */
const ownerWrite = defineAction<SyncSurface, [string, string]>({
  name: 'ownerWrite',
  draw: () =>
    gen(fc.tuple(fc.constantFrom('n0', 'n1'), fc.string({ maxLength: 10 }))),
  act: async (s, noteId, body) => {
    const client = s.clients.get('c0');
    if (client === undefined) throw new Error('c0 missing');
    await client.mutate(setNote, { id: noteId, body, title: '' });
  },
});

describe('authz graph PBT', () => {
  test(
    'non-owner delete cannot remove owner note from live set',
    async () => {
      for (const [i, noteId] of ['n0', 'n1'].entries()) {
        for (const body of ['', 'owned', 'twelve chars']) {
          await using s = await acmeSystem.script({
            seed: 900 + i,
            args: { clientCount: 2, rowImageFanout: i === 0 },
          });
          const [owner, peer] = await s.observe(clientIds);
          if (owner === undefined || peer === undefined) {
            throw new Error('two clients expected');
          }

          await s.apply(mutate, owner, setNote, {
            id: noteId,
            body,
            title: '',
          });
          await expectConverged(s);

          await s.apply(mutate, peer, deleteNote, { id: noteId });
          expect(await s.observe(lastMutationOk, peer)).toBe(false);
          expect(await s.observe(lastMutationFailures, peer)).toContain(
            'FORBIDDEN'
          );

          await expectConverged(s);
          await expectLiveNoteAt(s, owner, noteId, { body });
          await expectLiveNoteAt(s, peer, noteId, { body });
        }
      }
    },
    { timeout: 90_000 }
  );

  test(
    'authorized writes from the owner converge to one live row set',
    async () => {
      for (const seed of [921, 922, 923, 924, 925, 926]) {
        await using s = await acmeSystem.script({
          seed,
          args: {
            clientCount: 2,
            rowImageFanout: seed % 2 === 0,
            liveResendOnReconnect: seed % 3 === 0,
            bufferOutboundLive: seed % 4 === 0,
          },
        });
        const walk = await s.walk({
          actions: [ownerWrite],
          steps: 1 + (seed % 6),
        });
        expect(walk.coverage.actions['ownerWrite'] ?? 0).toBeGreaterThan(0);
        await expectConverged(s);
        await expectEveryClientNotesAgree(s);
      }
    },
    { timeout: 90_000 }
  );
});
