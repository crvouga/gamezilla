import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  createSpace,
  expectConverged,
  hasTopic,
  joinSpace,
  lacksTopic,
  leaveSpace,
  mutate,
  pubsubRemakeCount,
  roomTopic,
  SPACE_MEMBERSHIP_SESSION,
  subscribedTopics,
  untilAcme,
  userTopic,
} from '../apps/acme';

describe('leave join topics without pubsub remake', () => {
  test('leave then join different room without pubsub remake', async () => {
    await using s = await acmeSystem.script({
      seed: 801,
      args: {
        clientCount: 0,
      },
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
      id: 'space-a',
      title: 'A',
    });
    await s.apply(mutate, 'bob', joinSpace, { spaceId: 'space-a' });
    await expectConverged(s);

    await untilAcme(s, (s) => subscribedTopics(s, 'alice'), {
      pred: hasTopic(roomTopic('space-a')),
    });
    const topicsA = await s.observe(subscribedTopics, 'alice');
    expect(topicsA).toContain(userTopic('alice'));
    expect(topicsA).toContain(roomTopic('space-a'));
    const remakesAfterJoin = await s.observe(pubsubRemakeCount, 'alice');

    await s.apply(mutate, 'alice', leaveSpace, { spaceId: 'space-a' });
    await s.elapse(200);
    await untilAcme(s, (s) => subscribedTopics(s, 'alice'), {
      pred: lacksTopic(roomTopic('space-a')),
    });
    expect(await s.observe(pubsubRemakeCount, 'alice')).toBe(remakesAfterJoin);

    await s.apply(mutate, 'alice', createSpace, {
      id: 'space-b',
      title: 'B',
    });
    await s.elapse(200);
    await untilAcme(s, (s) => subscribedTopics(s, 'alice'), {
      pred: hasTopic(roomTopic('space-b')),
    });
    const topicsB = await s.observe(subscribedTopics, 'alice');
    expect(topicsB).toContain(roomTopic('space-b'));
    expect(topicsB).not.toContain(roomTopic('space-a'));
    expect(await s.observe(pubsubRemakeCount, 'alice')).toBe(remakesAfterJoin);

    await expectConverged(s);
  });
});
