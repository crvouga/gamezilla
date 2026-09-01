import { describe, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { syncFacade } from '../../sim/system';
import { expectLiveNote, isLiveNote, setNote } from '../apps/acme';
import { acmeSystem } from '../apps/acme/system';

describe('pubsub publish fails after commit heals by refetch', () => {
  // Pins Consistency table “Push lost”: commit acks, fanout drop, heal via refetch.
  test('lost publish leaves peers stale until foreground refetch', async () => {
    // rowImageFanout false: isolate server publish loss (no optimistic images).
    await using host = await openWorld(acmeSystem, {
      seed: 901,
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

    {
      using _hold = world.net('bob', 'sync').set('hold');
      using _pub = world.node('server').publishFault('next');
      await a.mutate(setNote, { id: 'n-lost-push', body: 'committed' });
      await world.until(() => isLiveNote(world.server.db, 'n-lost-push'), {
        budgetMs: 5_000,
      });
      await expectLiveNote(world.server.db, 'n-lost-push', {
        body: 'committed',
      });
      await world.never(() => isLiveNote(b.db, 'n-lost-push'), { forMs: 400 });
    }
    b.foreground(false);
    b.foreground(true);
    // nudge: heal-by-refetch after lost publish
    await world.until(b.nudge());
    await world.assertConverged();
    await expectLiveNote(b.db, 'n-lost-push', { body: 'committed' });
  });

  test.each([902, 903, 904])(
    'seed sweep: publish fault then reconnect heals (seed=%i)',
    async (seed) => {
      await using host = await openWorld(acmeSystem, {
        seed: seed,
        knobs: {
          clientCount: 0,
          rowImageFanout: false,
        },
      });
      const world = syncFacade(host.state);
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });
      using _pub = world.node('server').publishFault('next');
      await a.mutate(setNote, {
        id: `n-${seed}`,
        body: `b-${seed}`,
      });
      await world.runFor(200);
      await b.disconnect();
      await b.connect();
      await world.until(() => isLiveNote(b.db, `n-${seed}`), {
        budgetMs: 5_000,
      });
      await world.assertConverged();
      await expectLiveNote(b.db, `n-${seed}`, { body: `b-${seed}` });
    }
  );
});
