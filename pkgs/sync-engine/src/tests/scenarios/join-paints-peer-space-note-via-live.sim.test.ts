import { describe, test } from 'bun:test';
import { script } from '@pkgs/dst';
import {
  acmeKnobs,
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
  syncVirtualHost,
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
    await using run = await script(acmeSystem, {
      seed: 805,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, {
      id: 'alice',
      actorId: 'alice',
      sessionQuery: SPACE_MEMBERSHIP_SESSION,
    });
    await run.apply(addClient, {
      id: 'bob',
      actorId: 'bob',
      sessionQuery: SPACE_MEMBERSHIP_SESSION,
    });

    await run.apply(mutate, 'alice', createSpace, {
      id: 'live-room',
      title: 'L',
    });
    await expectConverged(run);
    await untilAcme(run, (s) => subscribedTopics(s, 'alice'), {
      pred: hasRoom('live-room'),
    });

    await run.apply(mutate, 'bob', joinSpace, { spaceId: 'live-room' });
    await untilAcme(run, (s) => subscribedTopics(s, 'bob'), {
      pred: hasRoom('live-room'),
    });

    await run.apply(hold, 'alice', 'sync');
    await run.apply(mutate, 'bob', setSpaceNote, {
      id: 'via-live',
      spaceId: 'live-room',
      body: 'from-bob',
    });
    await run.elapse(300);
    await expectLiveNoteAt(run, 'alice', 'via-live', { body: 'from-bob' });

    await run.apply(release, 'alice', 'sync');
    await expectConverged(run);
  });
});
