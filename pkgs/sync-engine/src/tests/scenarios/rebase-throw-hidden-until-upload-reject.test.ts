import { describe, expect, test } from 'bun:test';

import { RELIABLE_FAULTS } from '../../sim/faults';
import {
  listUnackedWriteRejections,
  mutationStatus,
} from '../../sim/mutation-status';
import {
  deleteNote,
  expectLiveNote,
  expectNoteNotLive,
  expectNotesMatchServer,
  setNote,
  setNoteStrictExists,
} from '../../sim/notes-app';
import { openSimWorld, type SimWorld } from '../../sim/world';

async function waitForStatus(
  world: SimWorld,
  db: Parameters<typeof mutationStatus>[0],
  mutationId: string,
  want: 'pending' | 'confirmed' | 'rejected'
): Promise<void> {
  for (let i = 0; i < 80; i += 1) {
    const status = await mutationStatus(db, mutationId);
    if (status === want) return;
    await world.runFor(50);
  }
  const status = await mutationStatus(db, mutationId);
  throw new Error(`expected status ${want}, got ${status}`);
}

describe('rebase throw hidden until upload reject', () => {
  test('strict update hidden after peer delete; upload rejects; converge', async () => {
    const world = await openSimWorld({
      seed: 821,
      faults: RELIABLE_FAULTS,
      rowImageFanout: false,
    });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });

      // Bob owns the row so peer soft-delete is authorized.
      await b.mutate(setNote, { id: 'n1', body: 'seed' });
      await world.assertConverged();

      await a.engine.disconnect();
      const pending = await a.mutate(setNoteStrictExists, {
        id: 'n1',
        body: 'strict-pending',
      });
      expect(pending.ok).toBe(true);
      if (!pending.ok) return;
      await expectLiveNote(a.db, 'n1', { body: 'strict-pending' });

      const del = await b.mutate(deleteNote, { id: 'n1' });
      expect(del.ok).toBe(true);
      await world.runFor(400);
      await expectNoteNotLive(world.server.db, 'n1');

      await a.engine.connect();
      // Merge+rebase throws → optimistic effect hidden (tombstone wins locally).
      await a.engine.waitForFirstSync();
      await world.runFor(200);
      await expectNoteNotLive(a.db, 'n1');

      a.engine.wakeUploads();
      await waitForStatus(world, a.db, pending.mutationId, 'rejected');
      const unacked = await listUnackedWriteRejections(a.db, a.deviceId);
      expect(unacked.length).toBe(1);
      expect(unacked[0]?.mutationId).toBe(pending.mutationId);

      await b.mutate(setNote, { id: 'bump', body: 'x' });
      await world.assertConverged();
      await expectNoteNotLive(a.db, 'n1');
      await expectNotesMatchServer(a.db, world.server.db);
      await expectNotesMatchServer(b.db, world.server.db);
    } finally {
      await world.dispose();
    }
  });
});
