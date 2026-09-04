import { describe, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  createSpace,
  expectConverged,
  expectLiveNoteAt,
  hasTopic,
  hold,
  joinSpace,
  lacksTopic,
  leaveSpace,
  liveNote,
  mutate,
  neverAcme,
  noteLive,
  release,
  roomTopic,
  SPACE_MEMBERSHIP_SESSION,
  setSpaceNote,
  subscribedTopics,
  untilAcme,
} from '../apps/acme';

describe('push for just unsubscribed topic ignored', () => {
  test('leave races room push; ignored without error; engine stays healthy', async () => {
    await using s = await acmeSystem.script({
      seed: 812,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, {
      id: 'alice',
      sessionQuery: SPACE_MEMBERSHIP_SESSION,
    });
    await s.apply(addClient, {
      id: 'bob',
      sessionQuery: SPACE_MEMBERSHIP_SESSION,
    });

    await s.apply(mutate, 'alice', createSpace, {
      id: 'race-room',
      title: 'R',
    });
    await expectConverged(s);
    await untilAcme(s, (s) => subscribedTopics(s, 'alice'), {
      pred: hasTopic(roomTopic('race-room')),
    });
    await s.apply(mutate, 'bob', joinSpace, { spaceId: 'race-room' });
    await untilAcme(s, (s) => subscribedTopics(s, 'bob'), {
      pred: hasTopic(roomTopic('race-room')),
    });
    await expectConverged(s);
    await untilAcme(s, (s) => subscribedTopics(s, 'alice'), {
      pred: hasTopic(roomTopic('race-room')),
    });

    await s.apply(mutate, 'alice', leaveSpace, { spaceId: 'race-room' });
    await untilAcme(s, (s) => subscribedTopics(s, 'alice'), {
      pred: lacksTopic(roomTopic('race-room')),
    });

    await s.apply(hold, 'alice', 'sync');
    await s.apply(mutate, 'bob', setSpaceNote, {
      id: 'late-push',
      spaceId: 'race-room',
      body: 'missed',
    });
    await neverAcme(s, (s) => liveNote(s, 'alice', 'late-push'), {
      forMs: 300,
      pred: noteLive,
    });
    await expectLiveNoteAt(s, 'bob', 'late-push', { body: 'missed' });
    await s.apply(release, 'alice', 'sync');

    await s.apply(mutate, 'alice', joinSpace, { spaceId: 'race-room' });
    await expectConverged(s);
    await expectLiveNoteAt(s, 'alice', 'late-push', { body: 'missed' });
  });
});
