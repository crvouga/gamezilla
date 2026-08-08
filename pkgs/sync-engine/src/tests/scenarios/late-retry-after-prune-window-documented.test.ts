import { describe, expect, test } from 'bun:test';
import {
  expectLiveNote,
  notesDomainPack,
  setNote,
} from '../../domain-packs/notes-app';
import { RELIABLE_FAULTS } from '../../sim/faults';
import { openSimWorld, type SimWorld } from '../../sim/world';

async function pump(
  world: SimWorld,
  work: Promise<unknown>,
  maxVirtualMs = 2_000
): Promise<void> {
  let done = false;
  const tracked = Promise.resolve(work).finally(() => {
    done = true;
  });
  const steps = Math.ceil(maxVirtualMs / 25);
  for (let i = 0; i < steps && !done; i += 1) {
    await world.runFor(25);
  }
  await tracked;
}

describe('late retry after prune window documented', () => {
  for (const seed of [860, 861, 862]) {
    test(`re-POST after prune double-applies (seed=${seed})`, async () => {
      // Known limitation: pruning idempotency rows lets a late retry with the
      // same mutation id apply again (setNote upsert → last write wins).
      // Retention jobs must keep the window longer than max client retry life.
      const world = await openSimWorld({
        domain: notesDomainPack,
        seed,
        faults: RELIABLE_FAULTS,
      });
      try {
        const a = await world.addClient({ id: 'alice' });
        await world.addClient({ id: 'bob' });

        const first = await a.mutate(setNote, { id: 'n1', body: 'original' });
        expect(first.ok).toBe(true);
        if (!first.ok) return;
        await world.assertConverged();
        await expectLiveNote(world.server.db, 'n1', { body: 'original' });

        // Sim applied_at uses wall-clock SQLite datetime; sim now is 2023.
        // Negative olderThanMs pushes cutoff into the future (keep it in the
        // 4-digit year range so ISO string compares cleanly with SQLite text).
        await world.server.pruneArtifacts(-2_000_000_000_000);

        // Direct server handler — same idempotency path as HTTP POST /mutations.
        world.server.setAuth({
          actorId: a.actorId,
          deviceId: a.deviceId,
          accountId: `acct:${a.actorId}`,
          isAnon: false,
        });
        const late = await world.server.handlers.handleMutations([
          {
            id: first.mutationId,
            name: 'setNote',
            args: JSON.stringify({ id: 'n1', body: 'after-prune' }),
            clientId: a.deviceId,
            seq: 1,
            createdAt: new Date(world.nowFor('alice')).toISOString(),
          },
        ]);
        expect(late.ok).toBe(true);
        expect(late.verdicts[0]?.status).toBe('applied');

        await pump(world, a.engine.refreshQueries());
        await world.assertConverged();

        // Pinned: prune + late retry with different args double-applies.
        await expectLiveNote(world.server.db, 'n1', { body: 'after-prune' });
      } finally {
        await world.dispose();
      }
    });
  }
});
