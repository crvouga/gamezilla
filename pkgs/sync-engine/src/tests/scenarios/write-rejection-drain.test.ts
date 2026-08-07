import { describe, expect, test } from 'bun:test';

import { RELIABLE_FAULTS } from '../../sim/faults';
import {
  listUnackedWriteRejections,
  mutationStatus,
} from '../../sim/mutation-status';
import {
  acknowledgeWriteRejectionMutation,
  expectLiveNote,
  expectNotesMatchServer,
  serverRejectNote,
  setNote,
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

describe('write rejection drain', () => {
  test('server reject stores write_rejection and merge restores domain', async () => {
    // rowImageFanout off: rejected optimistic body must not poison peers.
    const world = await openSimWorld({
      seed: 501,
      faults: RELIABLE_FAULTS,
      rowImageFanout: false,
    });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });

      await a.mutate(setNote, { id: 'n1', body: 'good' });
      await world.assertConverged();

      const rejected = await a.mutate(serverRejectNote, {
        id: 'n1',
        body: 'bad',
      });
      expect(rejected.ok).toBe(true);
      if (!rejected.ok) return;

      await waitForStatus(world, a.db, rejected.mutationId, 'rejected');
      expect(await mutationStatus(a.db, rejected.mutationId)).toBe('rejected');

      const unacked = await listUnackedWriteRejections(a.db, a.deviceId);
      expect(unacked.length).toBe(1);
      expect(unacked[0]?.code).toBe('FORBIDDEN');
      expect(unacked[0]?.mutationId).toBe(rejected.mutationId);

      // Peer never applied the rejected body.
      await expectLiveNote(b.db, 'n1', { body: 'good' });

      // not_modified would leave alice's optimistic body; bump server hash.
      await b.mutate(setNote, { id: 'bump', body: 'x' });
      await world.assertConverged();
      await expectLiveNote(a.db, 'n1', { body: 'good' });
      await expectNotesMatchServer(a.db, world.server.db);
      await expectNotesMatchServer(b.db, world.server.db);

      const ack = await a.mutate(acknowledgeWriteRejectionMutation, {
        rejectionId: unacked[0]!.id,
      });
      expect(ack.ok).toBe(true);
      if (!ack.ok) return;
      await waitForStatus(world, a.db, ack.mutationId, 'confirmed');
      const afterAck = await listUnackedWriteRejections(a.db, a.deviceId);
      expect(afterAck).toEqual([]);
    } finally {
      await world.dispose();
    }
  });
});
