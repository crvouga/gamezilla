import { describe, expect, test } from 'bun:test';
import { script } from '@pkgs/dst';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  expectConverged,
  liveNote,
  mutate,
  net,
  nudge,
  passTime,
  setNoteWrongTopic,
  syncVirtualHost,
} from '../apps/acme';

describe('wrong topic map heals on refetch', () => {
  // Companion to channel-exhaustiveness: wrong topic-map wake ⇒ silent staleness.
  test('peer stays stale until explicit refetch after wrong topic wake', async () => {
    await using run = await script(acmeSystem, {
      seed: 1080,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0, rowImageFanout: false }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });
    await run.apply(mutate, 'alice', setNoteWrongTopic, {
      id: 'warm',
      body: 'w',
    });
    // nudge: wrong topic — peer needs explicit refetch
    await run.apply(nudge, 'bob');
    expect(await run.observe(liveNote('bob', 'warm'))).toMatchObject({
      body: 'w',
    });

    {
      await run.apply(net, 'bob', 'sync', 'hold');
      await run.apply(mutate, 'alice', setNoteWrongTopic, {
        id: 'stale-until-refetch',
        body: 'missed-live',
      });
      await run.apply(passTime, 400);
      expect(
        await run.observe(liveNote('server', 'stale-until-refetch'))
      ).toMatchObject({
        body: 'missed-live',
      });
      expect(
        await run.observe(liveNote('bob', 'stale-until-refetch'))
      ).toBeNull();
    }
    // nudge: heal-by-refetch after wrong topic-map wake
    await run.apply(nudge, 'bob');
    await expectConverged(run);
    expect(
      await run.observe(liveNote('bob', 'stale-until-refetch'))
    ).toMatchObject({
      body: 'missed-live',
    });
  });

  test.each([1081, 1082, 1083])(
    'seed sweep wrong topic heals via refresh (seed=%i)',
    async (seed) => {
      await using run = await script(acmeSystem, {
        seed: seed,
        host: syncVirtualHost(),
        knobs: acmeKnobs({ clientCount: 0, rowImageFanout: false }),
        properties: [],
      });

      await run.apply(addClient, { id: 'alice' });
      await run.apply(addClient, { id: 'bob' });
      await run.apply(mutate, 'alice', setNoteWrongTopic, {
        id: `n-${seed}`,
        body: `b-${seed}`,
      });
      // nudge: heal-by-refetch is the behavior under test
      await run.apply(nudge, 'bob');
      await expectConverged(run);
      expect(await run.observe(liveNote('bob', `n-${seed}`))).toMatchObject({
        body: `b-${seed}`,
      });
    }
  );
});
