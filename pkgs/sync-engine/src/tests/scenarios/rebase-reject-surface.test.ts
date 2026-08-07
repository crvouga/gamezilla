import { describe, expect, test } from 'bun:test';

import { RELIABLE_FAULTS } from '../../sim/faults';
import {
  listUnackedWriteRejections,
  mutationStatus,
} from '../../sim/mutation-status';
import {
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

describe('rebase reject surface', () => {
  test('pending rejectable mutate uploads after reconnect, surfaces write_rejection, domain rolls back', async () => {
    // rowImageFanout off: rejected optimistic must not poison peers via images.
    const world = await openSimWorld({
      seed: 711,
      faults: RELIABLE_FAULTS,
      rowImageFanout: false,
    });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });

      await a.mutate(setNote, { id: 'n1', body: 'good' });
      await world.assertConverged();

      await a.engine.disconnect();
      const rejected = await a.mutate(serverRejectNote, {
        id: 'n1',
        body: 'bad-optimistic',
      });
      expect(rejected.ok).toBe(true);
      if (!rejected.ok) return;
      await expectLiveNote(a.db, 'n1', { body: 'bad-optimistic' });

      await a.engine.connect();
      a.engine.wakeUploads();
      await waitForStatus(world, a.db, rejected.mutationId, 'rejected');
      expect(await mutationStatus(a.db, rejected.mutationId)).toBe('rejected');

      const unacked = await listUnackedWriteRejections(a.db, a.deviceId);
      expect(unacked.length).toBe(1);
      expect(unacked[0]?.code).toBe('FORBIDDEN');
      expect(unacked[0]?.mutationId).toBe(rejected.mutationId);

      await b.mutate(setNote, { id: 'bump', body: 'x' });
      await world.assertConverged();
      await expectLiveNote(a.db, 'n1', { body: 'good' });
      await expectNotesMatchServer(a.db, world.server.db);
      await expectNotesMatchServer(b.db, world.server.db);
    } finally {
      await world.dispose();
    }
  });
});
