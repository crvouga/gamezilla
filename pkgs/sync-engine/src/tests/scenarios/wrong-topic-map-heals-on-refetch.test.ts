import { describe, test } from 'bun:test';
import {
  expectLiveNote,
  expectNoteNotLive,
  notesDomainPack,
  setNoteWrongTopic,
} from '../../domain-packs/notes-app';
import { openSimWorld } from '../../sim/world';

describe('wrong topic map heals on refetch', () => {
  // Companion to channel-exhaustiveness: wrong topic-map wake ⇒ silent staleness.
  test('peer stays stale until explicit refetch after wrong topic wake', async () => {
    await using world = await openSimWorld({
      domain: notesDomainPack,
      seed: 1080,
      rowImageFanout: false,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await a.mutate(setNoteWrongTopic, { id: 'warm', body: 'w' });
    // nudge: wrong topic — peer needs explicit refetch
    await world.until(b.nudge());
    await expectLiveNote(b.db, 'warm', { body: 'w' });

    {
      using _hold = world.net('bob', 'sync').set('hold');
      await a.mutate(setNoteWrongTopic, {
        id: 'stale-until-refetch',
        body: 'missed-live',
      });
      await world.runFor(400);
      await expectLiveNote(world.server.db, 'stale-until-refetch', {
        body: 'missed-live',
      });
      await expectNoteNotLive(b.db, 'stale-until-refetch');
    }
    // nudge: heal-by-refetch after wrong topic-map wake
    await world.until(b.nudge());
    await world.assertConverged();
    await expectLiveNote(b.db, 'stale-until-refetch', {
      body: 'missed-live',
    });
  });

  test.each([1081, 1082, 1083])(
    'seed sweep wrong topic heals via refresh (seed=%i)',
    async (seed) => {
      await using world = await openSimWorld({
        domain: notesDomainPack,
        seed,
        rowImageFanout: false,
      });
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });
      await a.mutate(setNoteWrongTopic, {
        id: `n-${seed}`,
        body: `b-${seed}`,
      });
      // nudge: heal-by-refetch is the behavior under test
      await world.until(b.nudge());
      await world.assertConverged();
      await expectLiveNote(b.db, `n-${seed}`, { body: `b-${seed}` });
    }
  );
});
