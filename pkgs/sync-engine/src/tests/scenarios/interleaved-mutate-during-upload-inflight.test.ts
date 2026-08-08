import { describe, expect, test } from 'bun:test';
import {
  expectLiveNote,
  expectNotesMatchServer,
  notesDomainPack,
  setNote,
} from '../../domain-packs/notes-app';
import { RELIABLE_FAULTS } from '../../sim/faults';
import { mutationStatus } from '../../sim/mutation-status';
import { openSimWorld, type SimWorld } from '../../sim/world';

async function waitForStatus(
  world: SimWorld,
  db: Parameters<typeof mutationStatus>[0],
  mutationId: string,
  want: 'pending' | 'confirmed' | 'rejected'
): Promise<void> {
  for (let i = 0; i < 100; i += 1) {
    const status = await mutationStatus(db, mutationId);
    if (status === want) return;
    await world.runFor(50);
  }
  const status = await mutationStatus(db, mutationId);
  throw new Error(`expected status ${want}, got ${status}`);
}

describe('interleaved mutate during upload inflight', () => {
  test('mutates while drain in flight join next batch; no loss', async () => {
    const world = await openSimWorld({
      domain: notesDomainPack,
      seed: 823,
      faults: RELIABLE_FAULTS,
    });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });

      await a.engine.disconnect();
      const first = await a.mutate(setNote, { id: 'n1', body: 'first' });
      const second = await a.mutate(setNote, { id: 'n2', body: 'second' });
      expect(first.ok && second.ok).toBe(true);
      if (!first.ok || !second.ok) return;

      // Hold sync so the first upload stays in flight while more mutates land.
      world.hold('alice', 'sync');
      await a.engine.connect();
      a.engine.wakeUploads();
      await world.runFor(50);

      const third = await a.mutate(setNote, { id: 'n3', body: 'third' });
      const fourth = await a.mutate(setNote, { id: 'n1', body: 'first-v2' });
      expect(third.ok && fourth.ok).toBe(true);
      if (!third.ok || !fourth.ok) return;

      world.release('alice', 'sync');
      a.engine.wakeUploads();
      await waitForStatus(world, a.db, fourth.mutationId, 'confirmed');
      await world.assertConverged();

      await expectLiveNote(b.db, 'n1', { body: 'first-v2' });
      await expectLiveNote(b.db, 'n2', { body: 'second' });
      await expectLiveNote(b.db, 'n3', { body: 'third' });
      await expectNotesMatchServer(a.db, world.server.db);
    } finally {
      await world.dispose();
    }
  });
});
