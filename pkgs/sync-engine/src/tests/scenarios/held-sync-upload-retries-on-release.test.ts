import { describe, expect, test } from 'bun:test';

import { RELIABLE_FAULTS } from '../../sim/faults';
import { mutationStatus } from '../../sim/mutation-status';
import { expectLiveNote, setNote } from '../../sim/notes-app';
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

describe('held sync upload retries on release', () => {
  test('held sync keeps queue pending then confirms after release', async () => {
    const world = await openSimWorld({ seed: 502, faults: RELIABLE_FAULTS });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });

      world.hold('alice', 'sync');
      const queued = await a.mutate(setNote, {
        id: 'n1',
        body: 'transient',
      });
      expect(queued.ok).toBe(true);
      if (!queued.ok) return;

      await world.runFor(200);
      expect(await mutationStatus(a.db, queued.mutationId)).toBe('pending');

      world.release('alice', 'sync');
      a.engine.wakeUploads();
      await waitForStatus(world, a.db, queued.mutationId, 'confirmed');
      await world.assertConverged();
      await expectLiveNote(b.db, 'n1', { body: 'transient' });
    } finally {
      await world.dispose();
    }
  });
});
