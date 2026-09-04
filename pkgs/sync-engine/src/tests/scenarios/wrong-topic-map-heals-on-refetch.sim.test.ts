import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  expectConverged,
  liveNote,
  mutate,
  net,
  nudge,
  setNoteWrongTopic,
} from '../apps/acme';

describe('wrong topic map heals on refetch', () => {
  // Companion to channel-exhaustiveness: wrong topic-map wake ⇒ silent staleness.
  test('peer stays stale until explicit refetch after wrong topic wake', async () => {
    await using s = await acmeSystem.script({
      seed: 1080,
      args: { clientCount: 0, rowImageFanout: false },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });
    await s.apply(mutate, 'alice', setNoteWrongTopic, {
      id: 'warm',
      body: 'w',
    });
    // nudge: wrong topic — peer needs explicit refetch
    await s.apply(nudge, 'bob');
    expect(await s.observe(liveNote, 'bob', 'warm')).toMatchObject({
      body: 'w',
    });

    {
      await s.apply(net, 'bob', 'sync', 'hold');
      await s.apply(mutate, 'alice', setNoteWrongTopic, {
        id: 'stale-until-refetch',
        body: 'missed-live',
      });
      await s.elapse(400);
      expect(
        await s.observe(liveNote, 'server', 'stale-until-refetch')
      ).toMatchObject({
        body: 'missed-live',
      });
      expect(
        await s.observe(liveNote, 'bob', 'stale-until-refetch')
      ).toBeNull();
    }
    // nudge: heal-by-refetch after wrong topic-map wake
    await s.apply(nudge, 'bob');
    await expectConverged(s);
    expect(
      await s.observe(liveNote, 'bob', 'stale-until-refetch')
    ).toMatchObject({
      body: 'missed-live',
    });
  });

  test.each([1081, 1082, 1083])(
    'seed sweep wrong topic heals via refresh (seed=%i)',
    async (seed) => {
      await using s = await acmeSystem.script({
        seed: seed,
        args: { clientCount: 0, rowImageFanout: false },
      });

      await s.apply(addClient, { id: 'alice' });
      await s.apply(addClient, { id: 'bob' });
      await s.apply(mutate, 'alice', setNoteWrongTopic, {
        id: `n-${seed}`,
        body: `b-${seed}`,
      });
      // nudge: heal-by-refetch is the behavior under test
      await s.apply(nudge, 'bob');
      await expectConverged(s);
      expect(await s.observe(liveNote, 'bob', `n-${seed}`)).toMatchObject({
        body: `b-${seed}`,
      });
    }
  );
});
