import { describe, expect, test } from 'bun:test';

import { RELIABLE_FAULTS } from '../../sim/faults';
import {
  listUnackedWriteRejections,
  mutationStatus,
} from '../../sim/mutation-status';
import { expectLiveNote, setNoteUniqueSlug } from '../../sim/notes-app';
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

describe('constraint error maps to business code', () => {
  for (const seed of [870, 871, 872]) {
    test(`unique conflict surfaces SLUG_TAKEN (seed=${seed})`, async () => {
      const world = await openSimWorld({
        seed,
        faults: RELIABLE_FAULTS,
        rowImageFanout: false,
      });
      try {
        const a = await world.addClient({ id: 'alice' });
        const b = await world.addClient({ id: 'bob' });

        // Bob offline so local DB lacks Alice's slug — conflict only on replay.
        await b.engine.disconnect();
        await a.mutate(setNoteUniqueSlug, {
          id: 'n1',
          slug: 'taken',
          body: 'owner',
        });
        await world.runFor(500);
        await expectLiveNote(world.server.db, 'n1', {
          body: 'owner',
          title: 'taken',
        });

        const rejected = await b.mutate(setNoteUniqueSlug, {
          id: 'n2',
          slug: 'taken',
          body: 'conflict',
        });
        expect(rejected.ok).toBe(true);
        if (!rejected.ok) return;

        await b.engine.connect();
        b.engine.wakeUploads();
        await waitForStatus(world, b.db, rejected.mutationId, 'rejected');
        const unacked = await listUnackedWriteRejections(b.db, b.deviceId);
        expect(unacked.some((r) => r.code === 'SLUG_TAKEN')).toBe(true);

        await expectLiveNote(a.db, 'n1', { body: 'owner', title: 'taken' });

        // Rejected insert left a local-only row (absence ≠ delete). Wipe cache
        // and rehydrate so converge can succeed.
        await b.engine.clearLocalData({ reason: 'cache' });
        await b.engine.connect();
        await world.assertConverged();
        await expectLiveNote(b.db, 'n1', { body: 'owner', title: 'taken' });
      } finally {
        await world.dispose();
      }
    });
  }
});
