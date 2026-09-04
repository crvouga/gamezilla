import { describe, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  createSpace,
  expectConverged,
  hold,
  joinSpace,
  mutate,
  release,
  roomTopic,
  SPACE_MEMBERSHIP_SESSION,
  setSpaceNote,
  subscribedTopics,
  untilAcme,
} from '../apps/acme';
import { expectLiveNoteAt } from '../apps/acme/reads';

/** Predicate for `subscribedTopics` containing one room topic. */
function hasRoom(spaceId: string) {
  return (topics: unknown): boolean =>
    Array.isArray(topics) && topics.includes(roomTopic(spaceId));
}

describe('join paints peer space note via live', () => {
  test('after join, peer space note paints via live while sync held', async () => {
    await using s = await acmeSystem.script({
      seed: 805,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, {
      id: 'alice',
      actorId: 'alice',
      sessionQuery: SPACE_MEMBERSHIP_SESSION,
    });
    await s.apply(addClient, {
      id: 'bob',
      actorId: 'bob',
      sessionQuery: SPACE_MEMBERSHIP_SESSION,
    });

    await s.apply(mutate, 'alice', createSpace, {
      id: 'live-room',
      title: 'L',
    });
    await expectConverged(s);
    await untilAcme(s, (s) => subscribedTopics(s, 'alice'), {
      pred: hasRoom('live-room'),
    });

    await s.apply(mutate, 'bob', joinSpace, { spaceId: 'live-room' });
    await untilAcme(s, (s) => subscribedTopics(s, 'bob'), {
      pred: hasRoom('live-room'),
    });

    await s.apply(hold, 'alice', 'sync');
    await s.apply(mutate, 'bob', setSpaceNote, {
      id: 'via-live',
      spaceId: 'live-room',
      body: 'from-bob',
    });
    await s.elapse(300);
    await expectLiveNoteAt(s, 'alice', 'via-live', { body: 'from-bob' });

    await s.apply(release, 'alice', 'sync');
    await expectConverged(s);
  });
});
