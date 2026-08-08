import { describe, expect, test } from 'bun:test';
import {
  expectLiveNote,
  expectNotesMatchServer,
  notesDomainPack,
  notesMutationRegistry,
  setNote,
  setNoteArgsLoose,
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

describe('args schema tightened server rejects stale args', () => {
  for (const seed of [790, 791, 792]) {
    test(`loose client args rejected by tight server (seed=${seed})`, async () => {
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
            [setNoteArgsLoose.name]: setNoteArgsLoose,
          },
        });
        const b = await world.addClient({ id: 'bob' });

        // Seed an existing row so reject heals via snapshot (absence ≠ delete).
        await a.mutate(setNote, { id: 'n1', body: 'short' });
        await world.assertConverged();

        await a.engine.disconnect();
        const longBody = 'x'.repeat(64);
        const rejected = await a.mutate(setNoteArgsLoose, {
          id: 'n1',
          body: longBody,
        });
        expect(rejected.ok).toBe(true);
        if (!rejected.ok) return;

        await a.engine.connect();
        a.engine.wakeUploads();
        await waitForStatus(world, a.db, rejected.mutationId, 'rejected');

        const unacked = await listUnackedWriteRejections(a.db, a.deviceId);
        expect(unacked.length).toBeGreaterThanOrEqual(1);
        expect(unacked.some((r) => r.mutationId === rejected.mutationId)).toBe(
          true
        );

        await expectLiveNote(world.server.db, 'n1', { body: 'short' });
        await expectLiveNote(b.db, 'n1', { body: 'short' });

        // Bump server hash so alice's optimistic long body is overwritten.
        await b.mutate(setNote, { id: 'ok', body: 'healthy' });
        await world.assertConverged();
        await expectLiveNote(a.db, 'n1', { body: 'short' });
        await expectLiveNote(a.db, 'ok', { body: 'healthy' });
        await expectNotesMatchServer(a.db, world.server.db);
      } finally {
        await world.dispose();
      }
    });
  }
});
