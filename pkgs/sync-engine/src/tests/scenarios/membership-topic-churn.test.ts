import { describe, expect, test } from 'bun:test';

import { RELIABLE_FAULTS } from '../../sim/faults';
import {
  createSpace,
  joinSpace,
  leaveSpace,
  roomTopic,
  SPACE_MEMBERSHIP_SESSION,
  userTopic,
} from '../../sim/notes-app';
import { openSimWorld, type SimWorld } from '../../sim/world';

async function waitForTopics(
  world: SimWorld,
  clientId: string,
  pred: (topics: readonly string[]) => boolean,
  maxVirtualMs = 2_000
): Promise<readonly string[]> {
  const client = world.clients.get(clientId);
  if (client === undefined) throw new Error(`missing client ${clientId}`);
  const steps = Math.ceil(maxVirtualMs / 25);
  for (let i = 0; i < steps; i += 1) {
    const topics = client.subscribedTopics();
    if (pred(topics)) return topics;
    await world.runFor(25);
  }
  return client.subscribedTopics();
}

describe('membership topic churn', () => {
  test('leave then join different room without pubsub remake', async () => {
    const world = await openSimWorld({ seed: 801, faults: RELIABLE_FAULTS });
    try {
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

      const topicsA = await waitForTopics(world, 'alice', (t) =>
        t.includes(roomTopic('space-a'))
      );
      expect(topicsA).toContain(userTopic('alice'));
      expect(topicsA).toContain(roomTopic('space-a'));
      const remakesAfterJoin = a.pubsubRemakeCount();

      await a.mutate(leaveSpace, { spaceId: 'space-a' });
      await world.runFor(200);
      const topicsLeft = await waitForTopics(
        world,
        'alice',
        (t) => !t.includes(roomTopic('space-a'))
      );
      expect(topicsLeft).not.toContain(roomTopic('space-a'));
      expect(a.pubsubRemakeCount()).toBe(remakesAfterJoin);

      await a.mutate(createSpace, { id: 'space-b', title: 'B' });
      await world.runFor(200);
      const topicsB = await waitForTopics(world, 'alice', (t) =>
        t.includes(roomTopic('space-b'))
      );
      expect(topicsB).toContain(roomTopic('space-b'));
      expect(topicsB).not.toContain(roomTopic('space-a'));
      expect(a.pubsubRemakeCount()).toBe(remakesAfterJoin);

      await world.assertConverged();
    } finally {
      await world.dispose();
    }
  });
});
