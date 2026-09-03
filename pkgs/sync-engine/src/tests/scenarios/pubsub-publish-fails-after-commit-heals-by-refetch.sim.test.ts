import { describe, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeDraws,
  acmeSystem,
  addClient,
  connect,
  disconnect,
  expectConverged,
  expectLiveNoteAt,
  foreground,
  hold,
  liveNote,
  mutate,
  neverAcme,
  noteBodyIs,
  nudge,
  passTime,
  publishFault,
  release,
  setNote,
  syncVirtualHost,
  untilAcme,
} from '../apps/acme';

describe('pubsub publish fails after commit heals by refetch', () => {
  // Pins Consistency table "Push lost": commit acks, fanout drop, heal via refetch.
  test('lost publish leaves peers stale until foreground refetch', async () => {
    // rowImageFanout false: isolate server publish loss (no optimistic images).
    await using run = await start(acmeSystem, {
      seed: 901,
      host: syncVirtualHost(),
      draws: acmeDraws({
        clientCount: 0,
        rowImageFanout: false,
      }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });
    await run.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
    await expectConverged(run);

    await run.apply(hold, 'bob', 'sync');
    await run.apply(publishFault, 'next');
    await run.apply(mutate, 'alice', setNote, {
      id: 'n-lost-push',
      body: 'committed',
    });
    await untilAcme(run, liveNote('server', 'n-lost-push'), {
      pred: noteBodyIs('committed'),
    });
    await expectLiveNoteAt(run, 'server', 'n-lost-push', {
      body: 'committed',
    });
    await neverAcme(run, liveNote('bob', 'n-lost-push'), { forMs: 400 });

    await run.apply(release, 'bob', 'sync');
    await run.apply(foreground, 'bob', false);
    await run.apply(foreground, 'bob', true);
    // nudge: heal-by-refetch after lost publish
    await run.apply(nudge, 'bob');
    await expectConverged(run);
    await expectLiveNoteAt(run, 'bob', 'n-lost-push', { body: 'committed' });
  });

  test.each([902, 903, 904])(
    'seed sweep: publish fault then reconnect heals (seed=%i)',
    async (seed) => {
      await using run = await start(acmeSystem, {
        seed: seed,
        host: syncVirtualHost(),
        draws: acmeDraws({
          clientCount: 0,
          rowImageFanout: false,
        }),
        properties: [],
      });

      await run.apply(addClient, { id: 'alice' });
      await run.apply(addClient, { id: 'bob' });
      await run.apply(publishFault, 'next');
      await run.apply(mutate, 'alice', setNote, {
        id: `n-${seed}`,
        body: `b-${seed}`,
      });
      await run.apply(passTime, 200);
      await run.apply(disconnect, 'bob');
      await run.apply(connect, 'bob');
      await untilAcme(run, liveNote('bob', `n-${seed}`), {
        pred: noteBodyIs(`b-${seed}`),
      });
      await expectConverged(run);
      await expectLiveNoteAt(run, 'bob', `n-${seed}`, { body: `b-${seed}` });
    }
  );
});
