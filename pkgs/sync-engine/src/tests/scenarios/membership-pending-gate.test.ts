import { describe, expect, test } from 'bun:test';

import { RELIABLE_FAULTS } from '../../sim/faults';
import {
  createSpace,
  leaveSpace,
  roomTopic,
  SPACE_MEMBERSHIP_SESSION,
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

describe('membership pending gate', () => {
  test('topic sync waits until pending mutations drain', async () => {
    const world = await openSimWorld({ seed: 803, faults: RELIABLE_FAULTS });
    try {
      const a = await world.addClient({
        id: 'alice',
        sessionQuery: SPACE_MEMBERSHIP_SESSION,
      });
      await a.mutate(createSpace, { id: 'gated', title: 'G' });
      await world.assertConverged();
      await waitForTopics(world, 'alice', (t) =>
        t.includes(roomTopic('gated'))
      );

      world.hold('alice', 'sync');
      await a.mutate(leaveSpace, { spaceId: 'gated' });
      await world.runFor(300);
      // Upload held → membership sync must not drop room topic yet.
      expect(a.subscribedTopics()).toContain(roomTopic('gated'));

      world.release('alice', 'sync');
      await a.engine.wakeUploads();
      const topics = await waitForTopics(
        world,
        'alice',
        (t) => !t.includes(roomTopic('gated'))
      );
      expect(topics).not.toContain(roomTopic('gated'));
      await world.assertConverged();
    } finally {
      await world.dispose();
    }
  });
});
