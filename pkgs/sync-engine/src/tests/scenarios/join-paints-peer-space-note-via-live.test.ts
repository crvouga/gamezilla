import { describe, test } from 'bun:test';
import {
  createSpace,
  expectLiveNote,
  joinSpace,
  acmeDomainPack,
  roomTopic,
  SPACE_MEMBERSHIP_SESSION,
  setSpaceNote,
} from '../apps/acme';
import { openSimWorld } from '../../sim/world';

describe('join paints peer space note via live', () => {
  test('after join, peer space note paints via live while sync held', async () => {
    await using world = await openSimWorld({
      domain: acmeDomainPack,
      seed: 805,
    });
    const a = await world.addClient({
      id: 'alice',
      sessionQuery: SPACE_MEMBERSHIP_SESSION,
    });
    const b = await world.addClient({
      id: 'bob',
      sessionQuery: SPACE_MEMBERSHIP_SESSION,
    });

    await a.mutate(createSpace, { id: 'live-room', title: 'L' });
    await world.assertConverged();
    await world.until(() =>
      a.subscribedTopics().includes(roomTopic('live-room'))
    );

    await b.mutate(joinSpace, { spaceId: 'live-room' });
    await world.until(() =>
      b.subscribedTopics().includes(roomTopic('live-room'))
    );

    {
      using _hold = world.net('alice', 'sync').set('hold');
      await b.mutate(setSpaceNote, {
        id: 'via-live',
        spaceId: 'live-room',
        body: 'from-bob',
      });
      await world.runFor(300);
      await expectLiveNote(a.db, 'via-live', { body: 'from-bob' });
    }
    await world.assertConverged();
  });
});
