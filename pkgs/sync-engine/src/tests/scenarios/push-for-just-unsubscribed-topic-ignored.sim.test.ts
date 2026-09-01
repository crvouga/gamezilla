import { describe, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import {
  createSpace,
  expectLiveNote,
  isLiveNote,
  joinSpace,
  leaveSpace,
  roomTopic,
  SPACE_MEMBERSHIP_SESSION,
  setSpaceNote,
} from '../apps/acme';
import { acmeSystem } from '../apps/acme/system';

describe('push for just unsubscribed topic ignored', () => {
  test('leave races room push; ignored without error; engine stays healthy', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 812,
      knobs: {
        clientCount: 0,
      },
    });
    const world = host.facade;
    const a = await world.addClient({
      id: 'alice',
      sessionQuery: SPACE_MEMBERSHIP_SESSION,
    });
    const b = await world.addClient({
      id: 'bob',
      sessionQuery: SPACE_MEMBERSHIP_SESSION,
    });

    await a.mutate(createSpace, { id: 'race-room', title: 'R' });
    await b.mutate(joinSpace, { spaceId: 'race-room' });
    await world.assertConverged();
    await world.until(() =>
      a.subscribedTopics().includes(roomTopic('race-room'))
    );

    await a.mutate(leaveSpace, { spaceId: 'race-room' });
    await world.until(
      () => !a.subscribedTopics().includes(roomTopic('race-room'))
    );

    {
      using _hold = world.net('alice', 'sync').set('hold');
      await b.mutate(setSpaceNote, {
        id: 'late-push',
        spaceId: 'race-room',
        body: 'missed',
      });
      await world.never(() => isLiveNote(a.db, 'late-push'), { forMs: 300 });
      await expectLiveNote(b.db, 'late-push', { body: 'missed' });
    }
    await a.mutate(joinSpace, { spaceId: 'race-room' });
    await world.assertConverged();
    await expectLiveNote(a.db, 'late-push', { body: 'missed' });
  });
});
