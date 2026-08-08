import { describe, expect, test } from 'bun:test';
import {
  expectLiveNote,
  expectNotesMatchServer,
  notesDomainPack,
  serverRejectNote,
  setNote,
} from '../../domain-packs/notes-app';
import { RELIABLE_FAULTS } from '../../sim/faults';
import {
  listUnackedWriteRejections,
  mutationStatus,
} from '../../sim/mutation-status';
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

describe('optimistic push rejected server side heals', () => {
  test('optimistic live paint on peer heals to server truth after reject', async () => {
    const world = await openSimWorld({
      domain: notesDomainPack,
      seed: 810,
      faults: RELIABLE_FAULTS,
      bufferOutboundLive: true,
    });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });

      await a.mutate(setNote, { id: 'n1', body: 'good' });
      await world.assertConverged();

      // Hold mutator sync so upload cannot ack; peer may still see optimistic.
      world.hold('alice', 'sync');
      world.hold('bob', 'sync');
      const rejected = await a.mutate(serverRejectNote, {
        id: 'n1',
        body: 'bad-optimistic',
      });
      expect(rejected.ok).toBe(true);
      if (!rejected.ok) return;

      await world.runFor(300);
      await expectLiveNote(b.db, 'n1', { body: 'bad-optimistic' });

      world.release('alice', 'sync');
      a.engine.wakeUploads();
      await waitForStatus(world, a.db, rejected.mutationId, 'rejected');
      expect((await listUnackedWriteRejections(a.db, a.deviceId)).length).toBe(
        1
      );

      world.release('bob', 'sync');
      await b.mutate(setNote, { id: 'bump', body: 'x' });
      await world.assertConverged();

      await expectLiveNote(a.db, 'n1', { body: 'good' });
      await expectLiveNote(b.db, 'n1', { body: 'good' });
      await expectNotesMatchServer(a.db, world.server.db);
      await expectNotesMatchServer(b.db, world.server.db);
    } finally {
      await world.dispose();
    }
  });
});
