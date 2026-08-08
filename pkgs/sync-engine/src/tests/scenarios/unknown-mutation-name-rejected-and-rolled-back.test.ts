import { describe, expect, test } from 'bun:test';
import {
  expectLiveNote,
  expectNotesMatchServer,
  ghostMutation,
  notesDomainPack,
  notesMutationRegistry,
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

describe('unknown mutation name rejected and rolled back', () => {
  for (const seed of [770, 771, 772]) {
    test(`ghostMutation rejected; merge heals (seed=${seed})`, async () => {
      const world = await openSimWorld({
        domain: notesDomainPack,
        seed,
        faults: RELIABLE_FAULTS,
        rowImageFanout: false,
      });
      try {
        const a = await world.addClient({
          id: 'alice',
          mutationRegistry: {
            ...notesMutationRegistry,
            [ghostMutation.name]: ghostMutation,
          },
        });
        const b = await world.addClient({ id: 'bob' });

        await a.mutate(setNote, { id: 'n1', body: 'good' });
        await world.assertConverged();

        const rejected = await a.mutate(ghostMutation, {
          id: 'n1',
          body: 'ghost-body',
        });
        expect(rejected.ok).toBe(true);
        if (!rejected.ok) return;

        await waitForStatus(world, a.db, rejected.mutationId, 'rejected');
        expect(await mutationStatus(a.db, rejected.mutationId)).toBe(
          'rejected'
        );

        const unacked = await listUnackedWriteRejections(a.db, a.deviceId);
        expect(unacked.length).toBe(1);
        expect(unacked[0]?.code).toBe('UNKNOWN_MUTATION');
        expect(unacked[0]?.mutationId).toBe(rejected.mutationId);

        await expectLiveNote(b.db, 'n1', { body: 'good' });

        await b.mutate(setNote, { id: 'bump', body: 'x' });
        await world.assertConverged();
        await expectLiveNote(a.db, 'n1', { body: 'good' });
        await expectNotesMatchServer(a.db, world.server.db);
      } finally {
        await world.dispose();
      }
    });
  }
});
