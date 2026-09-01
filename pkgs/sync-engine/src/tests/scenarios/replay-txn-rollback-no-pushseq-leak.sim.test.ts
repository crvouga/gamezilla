import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { syncFacade } from '../../sim/system';
import {
  expectLiveNote,
  expectNoteNotLive,
  readLiveNotes,
  setNote,
} from '../apps/acme';
import { acmeSystem } from '../apps/acme/system';

describe('replay txn rollback no pushseq leak', () => {
  test('in-txn fail rolls back; peer sees no push; retry applies once', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 910,
      knobs: {
        clientCount: 0,
        rowImageFanout: false,
      },
    });
    const world = syncFacade(host.state);
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await a.mutate(setNote, { id: 'warm', body: 'w' });
    await world.assertConverged();

    // Hold peer sync so a successful retry cannot hydrate bob before we
    // observe the failed attempt's lack of live paint.
    using holdSync = world.net('bob', 'sync').set('hold');
    using holdLive = world.net('bob', 'live').set('hold');
    using _fault = world.node('alice').httpFault({
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

    holdLive.restore();
    holdSync.restore();
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
  });

  test.each([911, 912, 913])(
    'seed sweep converges after in-txn fault (seed=%i)',
    async (seed) => {
      await using host = await openWorld(acmeSystem, {
        seed: seed,
        knobs: {
          clientCount: 0,
        },
      });
      const world = syncFacade(host.state);
      const a = await world.addClient({ id: 'alice' });
      await world.addClient({ id: 'bob' });
      using _fault = world.node('alice').httpFault({
        kind: 'failMutationsInsideTxnAfter',
        after: 0,
      });
      await a.mutate(setNote, { id: `n-${seed}`, body: `b-${seed}` });
      await world.assertConverged();
      await expectLiveNote(world.server.db, `n-${seed}`, {
        body: `b-${seed}`,
      });
    }
  );
});
