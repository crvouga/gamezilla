import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  createSpace,
  expectConverged,
  hasTopic,
  joinSpace,
  leaveSpace,
  liveNote,
  mutate,
  pubsubRemakeCount,
  roomTopic,
  SPACE_MEMBERSHIP_SESSION,
  setSpaceNote,
  subscribedTopics,
  untilAcme,
} from '../apps/acme';

describe('peer create during leave keeps mqtt session', () => {
  test('peer create during leave does not remake MQTT; rejoin hydrates', async () => {
    await using s = await acmeSystem.script({
      seed: 802,
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

    await s.apply(mutate, 'alice', createSpace, { id: 'room-1', title: 'R' });
    await expectConverged(s);
    await untilAcme(s, (s) => subscribedTopics(s, 'alice'), {
      pred: hasTopic(roomTopic('room-1')),
    });
    await s.apply(mutate, 'bob', joinSpace, { spaceId: 'room-1' });
    await untilAcme(s, (s) => subscribedTopics(s, 'bob'), {
      pred: hasTopic(roomTopic('room-1')),
    });
    await expectConverged(s);
    await untilAcme(s, (s) => subscribedTopics(s, 'alice'), {
      pred: hasTopic(roomTopic('room-1')),
    });
    const remakes = await s.observe(pubsubRemakeCount, 'alice');

    await s.apply(mutate, 'alice', leaveSpace, { spaceId: 'room-1' });
    await s.apply(mutate, 'bob', setSpaceNote, {
      id: 'n-during-leave',
      spaceId: 'room-1',
      body: 'created-while-leave',
    });
    await s.elapse(300);

    expect(await s.observe(pubsubRemakeCount, 'alice')).toBe(remakes);
    expect(await s.observe(liveNote, 'bob', 'n-during-leave')).toMatchObject({
      body: 'created-while-leave',
    });
    expect(await s.observe(liveNote, 'server', 'n-during-leave')).toMatchObject(
      { body: 'created-while-leave' }
    );

    await s.apply(mutate, 'alice', joinSpace, { spaceId: 'room-1' });
    await expectConverged(s);
    expect(await s.observe(liveNote, 'alice', 'n-during-leave')).toMatchObject({
      body: 'created-while-leave',
    });
    expect(await s.observe(pubsubRemakeCount, 'alice')).toBe(remakes);
  });
});
