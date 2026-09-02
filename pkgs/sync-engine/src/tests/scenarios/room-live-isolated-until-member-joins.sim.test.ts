import { describe, test } from 'bun:test';
import {
  createSpace,
  expectLiveNote,
  isLiveNote,
  joinSpace,
  roomTopic,
  SPACE_MEMBERSHIP_SESSION,
  setSpaceNote,
} from '../apps/acme';
import { openAcmeWorld } from '../apps/acme/system';

describe('room live isolated until member joins', () => {
  test('live on room-B does not reach alice in room-A until join', async () => {
    await using world = await openAcmeWorld({
      seed: 804,
      knobs: {
        clientCount: 0,
      },
    });

    const a = await world.addClient({
      id: 'alice',
      sessionQuery: SPACE_MEMBERSHIP_SESSION,
    });
    const b = await world.addClient({
      id: 'bob',
      sessionQuery: SPACE_MEMBERSHIP_SESSION,
    });

    await a.mutate(createSpace, { id: 'room-a', title: 'A' });
    await b.mutate(createSpace, { id: 'room-b', title: 'B' });
    await world.waitUntil(() =>
      a.subscribedTopics().includes(roomTopic('room-a'))
    );
    await world.waitUntil(() =>
      b.subscribedTopics().includes(roomTopic('room-b'))
    );

    await b.mutate(setSpaceNote, {
      id: 'b-only',
      spaceId: 'room-b',
      body: 'secret-b',
    });
    await world.waitNever(() => isLiveNote(a.db, 'b-only'), { forMs: 300 });
    await expectLiveNote(b.db, 'b-only', { body: 'secret-b' });

    await a.mutate(joinSpace, { spaceId: 'room-b' });
    await world.waitUntil(() =>
      a.subscribedTopics().includes(roomTopic('room-b'))
    );
    await world.assertConverged();
    await expectLiveNote(a.db, 'b-only', { body: 'secret-b' });
  });
});
