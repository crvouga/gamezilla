import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  createSpace,
  expectConverged,
  hasTopic,
  joinSpace,
  liveNote,
  mutate,
  neverAcme,
  noteLive,
  roomTopic,
  SPACE_MEMBERSHIP_SESSION,
  setSpaceNote,
  subscribedTopics,
  untilAcme,
} from '../apps/acme';

describe('room live isolated until member joins', () => {
  test('live on room-B does not reach alice in room-A until join', async () => {
    await using s = await acmeSystem.script({
      seed: 804,
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

    await s.apply(mutate, 'alice', createSpace, { id: 'room-a', title: 'A' });
    await s.apply(mutate, 'bob', createSpace, { id: 'room-b', title: 'B' });
    await untilAcme(s, (s) => subscribedTopics(s, 'alice'), {
      pred: hasTopic(roomTopic('room-a')),
    });
    await untilAcme(s, (s) => subscribedTopics(s, 'bob'), {
      pred: hasTopic(roomTopic('room-b')),
    });

    await s.apply(mutate, 'bob', setSpaceNote, {
      id: 'b-only',
      spaceId: 'room-b',
      body: 'secret-b',
    });
    await neverAcme(s, (s) => liveNote(s, 'alice', 'b-only'), {
      forMs: 300,
      pred: noteLive,
    });
    expect(await s.observe(liveNote, 'bob', 'b-only')).toMatchObject({
      body: 'secret-b',
    });

    await s.apply(mutate, 'alice', joinSpace, { spaceId: 'room-b' });
    await untilAcme(s, (s) => subscribedTopics(s, 'alice'), {
      pred: hasTopic(roomTopic('room-b')),
    });
    await expectConverged(s);
    expect(await s.observe(liveNote, 'alice', 'b-only')).toMatchObject({
      body: 'secret-b',
    });
  });
});
