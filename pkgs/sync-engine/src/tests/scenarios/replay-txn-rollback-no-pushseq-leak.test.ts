import { describe, expect, test } from 'bun:test';
import {
  expectLiveNote,
  expectNoteNotLive,
  notesDomainPack,
  readLiveNotes,
  setNote,
} from '../../domain-packs/notes-app';
import { RELIABLE_FAULTS } from '../../sim/faults';
import { openSimWorld } from '../../sim/world';

describe('replay txn rollback no pushseq leak', () => {
  test('in-txn fail rolls back; peer sees no push; retry applies once', async () => {
    const world = await openSimWorld({
      domain: notesDomainPack,
      seed: 910,
      faults: RELIABLE_FAULTS,
      rowImageFanout: false,
    });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });
      await a.mutate(setNote, { id: 'warm', body: 'w' });
      await world.assertConverged();

      // Hold peer sync so a successful retry cannot hydrate bob before we
      // observe the failed attempt's lack of live paint.
      world.hold('bob', 'sync');
      world.hold('bob', 'live');
      world.armHttpFault('alice', {
        kind: 'failMutationsInsideTxnAfter',
        after: 0,
      });
      const queued = await a.mutate(setNote, {
        id: 'n-rollback',
        body: 'should-retry',
      });
      expect(queued.ok).toBe(true);

      // First upload hits in-txn fault (rollback). Allow one retry window.
      await world.runFor(100);
      await expectNoteNotLive(b.db, 'n-rollback');

      world.release('bob', 'live');
      world.release('bob', 'sync');
      a.engine.wakeUploads();
      await world.assertConverged();
      await expectLiveNote(b.db, 'n-rollback', { body: 'should-retry' });
      await expectLiveNote(world.server.db, 'n-rollback', {
        body: 'should-retry',
      });
      expect(
        (await readLiveNotes(world.server.db)).filter(
          (n) => n.id === 'n-rollback'
        ).length
      ).toBe(1);
      expect(await world.checkInvariants()).toBeNull();
    } finally {
      await world.dispose();
    }
  });

  test('seed sweep converges after in-txn fault', async () => {
    for (const seed of [911, 912, 913] as const) {
      const world = await openSimWorld({
        domain: notesDomainPack,
        seed,
        faults: RELIABLE_FAULTS,
      });
      try {
        const a = await world.addClient({ id: 'alice' });
        await world.addClient({ id: 'bob' });
        world.armHttpFault('alice', {
          kind: 'failMutationsInsideTxnAfter',
          after: 0,
        });
        await a.mutate(setNote, { id: `n-${seed}`, body: `b-${seed}` });
        a.engine.wakeUploads();
        await world.assertConverged();
        await expectLiveNote(world.server.db, `n-${seed}`, {
          body: `b-${seed}`,
        });
      } finally {
        await world.dispose();
      }
    }
  });
});
