import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { unsafe } from '@pkgs/sql';
import { syncFacade } from '../../sim/system';
import {
  expectLiveNote,
  expectNoteNotLive,
  expectNotesMatchServer,
  setNote,
} from '../apps/acme';
import { acmeSystem } from '../apps/acme/system';

describe('corrupt queued args permanent reject', () => {
  test.each([2140, 2141, 2142])(
    'non-json queued args reject permanently; healthy mutate drains (seed=%i)',
    async (seed) => {
      await using host = await openWorld(acmeSystem, {
        seed: seed,
        knobs: {
          clientCount: 0,
        },
      });
      const world = syncFacade(host.system);
      const alice = await world.addClient({ id: 'alice' });
      const bob = await world.addClient({ id: 'bob' });

      // Seed so reject heals via snapshot (absence ≠ delete for brand-new ids).
      await alice.mutate(setNote, { id: 'n1', body: 'seed' });
      await world.assertConverged();

      await alice.disconnect();
      const pending = await alice.mutate(setNote, {
        id: 'n1',
        body: 'will-reject',
      });
      expect(pending.ok).toBe(true);
      if (!pending.ok) return;

      await alice.db.run(
        unsafe(
          `UPDATE sync_engine_mutations SET args = '__not_json__' WHERE id = '${pending.mutationId}'`
        )
      );

      await alice.connect();
      await world.until(alice.outcome(pending.mutationId), { budgetMs: 5_000 });
      expect(await alice.outcome(pending.mutationId)).toBe('rejected');

      const unacked = await alice.rejections();
      expect(unacked.some((r) => r.mutationId === pending.mutationId)).toBe(
        true
      );
      expect(unacked.some((r) => r.code === 'INVALID_ARGS')).toBe(true);

      await expectLiveNote(world.server.db, 'n1', { body: 'seed' });
      await expectLiveNote(bob.db, 'n1', { body: 'seed' });

      // Bump server hash so alice's optimistic body is overwritten.
      await bob.mutate(setNote, { id: 'ok', body: 'healthy' });
      await world.assertConverged();
      await expectLiveNote(alice.db, 'n1', { body: 'seed' });
      await expectLiveNote(alice.db, 'ok', { body: 'healthy' });
      await expectNotesMatchServer(alice.db, world.server.db);
    }
  );

  test('brand-new note with corrupt queued args tombstones after reject', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 2143,
      knobs: {
        clientCount: 0,
      },
    });
    const world = syncFacade(host.system);
    const alice = await world.addClient({ id: 'alice' });
    const bob = await world.addClient({ id: 'bob' });

    await alice.disconnect();
    const pending = await alice.mutate(setNote, {
      id: 'orphan',
      body: 'will-reject',
    });
    expect(pending.ok).toBe(true);
    if (!pending.ok) return;

    await alice.db.run(
      unsafe(
        `UPDATE sync_engine_mutations SET args = '__not_json__' WHERE id = '${pending.mutationId}'`
      )
    );

    await alice.connect();
    await world.until(alice.outcome(pending.mutationId), { budgetMs: 5_000 });
    expect(await alice.outcome(pending.mutationId)).toBe('rejected');

    await bob.mutate(setNote, { id: 'ok', body: 'healthy' });
    await world.assertConverged();
    await expectNoteNotLive(alice.db, 'orphan');
    await expectLiveNote(alice.db, 'ok', { body: 'healthy' });
    await expectNotesMatchServer(alice.db, world.server.db);
  });
});
