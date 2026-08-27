import { describe, expect, test } from 'bun:test';
import {
  createSpace,
  joinSpace,
  leaveSpace,
  acmeDomainPack,
  roomTopic,
  SPACE_MEMBERSHIP_SESSION,
  userTopic,
} from '../apps/acme';
import { openSimWorld } from '../../sim/world';

describe('leave join topics without pubsub remake', () => {
  test('leave then join different room without pubsub remake', async () => {
    await using world = await openSimWorld({
      domain: acmeDomainPack,
      seed: 801,
    });
    const a = await world.addClient({
      id: 'alice',
      sessionQuery: SPACE_MEMBERSHIP_SESSION,
    });
    const b = await world.addClient({
      id: 'bob',
      sessionQuery: SPACE_MEMBERSHIP_SESSION,
    });

    await a.mutate(createSpace, { id: 'space-a', title: 'A' });
    await b.mutate(joinSpace, { spaceId: 'space-a' });
    await world.assertConverged();

    await world.until(() =>
      a.subscribedTopics().includes(roomTopic('space-a'))
    );
    const topicsA = a.subscribedTopics();
    expect(topicsA).toContain(userTopic('alice'));
    expect(topicsA).toContain(roomTopic('space-a'));
    const remakesAfterJoin = a.pubsubRemakeCount();

    await a.mutate(leaveSpace, { spaceId: 'space-a' });
    await world.runFor(200);
    await world.until(
      () => !a.subscribedTopics().includes(roomTopic('space-a'))
    );
    expect(a.subscribedTopics()).not.toContain(roomTopic('space-a'));
    expect(a.pubsubRemakeCount()).toBe(remakesAfterJoin);

    await a.mutate(createSpace, { id: 'space-b', title: 'B' });
    await world.runFor(200);
    await world.until(() =>
      a.subscribedTopics().includes(roomTopic('space-b'))
    );
    const topicsB = a.subscribedTopics();
    expect(topicsB).toContain(roomTopic('space-b'));
    expect(topicsB).not.toContain(roomTopic('space-a'));
    expect(a.pubsubRemakeCount()).toBe(remakesAfterJoin);

    await world.assertConverged();
  });
});
