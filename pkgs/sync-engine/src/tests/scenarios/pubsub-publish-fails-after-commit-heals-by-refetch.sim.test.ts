import { describe, test } from 'bun:test';
import {
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
  publishFault,
  release,
  setNote,
  untilAcme,
} from '../apps/acme';

describe('pubsub publish fails after commit heals by refetch', () => {
  // Pins Consistency table "Push lost": commit acks, fanout drop, heal via refetch.
  test('lost publish leaves peers stale until foreground refetch', async () => {
    // rowImageFanout false: isolate server publish loss (no optimistic images).
    await using s = await acmeSystem.script({
      seed: 901,
      args: {
        clientCount: 0,
        rowImageFanout: false,
      },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });
    await s.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
    await expectConverged(s);

    await s.apply(hold, 'bob', 'sync');
    await s.apply(publishFault, 'next');
    await s.apply(mutate, 'alice', setNote, {
      id: 'n-lost-push',
      body: 'committed',
    });
    await untilAcme(s, (s) => liveNote(s, 'server', 'n-lost-push'), {
      pred: noteBodyIs('committed'),
    });
    await expectLiveNoteAt(s, 'server', 'n-lost-push', {
      body: 'committed',
    });
    await neverAcme(s, (s) => liveNote(s, 'bob', 'n-lost-push'), {
      forMs: 400,
    });

    await s.apply(release, 'bob', 'sync');
    await s.apply(foreground, 'bob', false);
    await s.apply(foreground, 'bob', true);
    // nudge: heal-by-refetch after lost publish
    await s.apply(nudge, 'bob');
    await expectConverged(s);
    await expectLiveNoteAt(s, 'bob', 'n-lost-push', { body: 'committed' });
  });

  test.each([902, 903, 904])(
    'seed sweep: publish fault then reconnect heals (seed=%i)',
    async (seed) => {
      await using s = await acmeSystem.script({
        seed: seed,
        args: {
          clientCount: 0,
          rowImageFanout: false,
        },
      });

      await s.apply(addClient, { id: 'alice' });
      await s.apply(addClient, { id: 'bob' });
      await s.apply(publishFault, 'next');
      await s.apply(mutate, 'alice', setNote, {
        id: `n-${seed}`,
        body: `b-${seed}`,
      });
      await s.elapse(200);
      await s.apply(disconnect, 'bob');
      await s.apply(connect, 'bob');
      await untilAcme(s, (s) => liveNote(s, 'bob', `n-${seed}`), {
        pred: noteBodyIs(`b-${seed}`),
      });
      await expectConverged(s);
      await expectLiveNoteAt(s, 'bob', `n-${seed}`, { body: `b-${seed}` });
    }
  );
});
