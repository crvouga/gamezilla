import { describe, expect, test } from 'bun:test';

import { RELIABLE_FAULTS } from '../../sim/faults';
import {
  createSpace,
  expectLiveNote,
  joinSpace,
  leaveSpace,
  roomTopic,
  SPACE_MEMBERSHIP_SESSION,
  setSpaceNote,
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

describe('membership create during leave', () => {
  test('peer create during leave does not remake MQTT; rejoin hydrates', async () => {
    const world = await openSimWorld({ seed: 802, faults: RELIABLE_FAULTS });
    try {
      const a = await world.addClient({
        id: 'alice',
        sessionQuery: SPACE_MEMBERSHIP_SESSION,
      });
      const b = await world.addClient({
        id: 'bob',
        sessionQuery: SPACE_MEMBERSHIP_SESSION,
      });

      await a.mutate(createSpace, { id: 'room-1', title: 'R' });
      await b.mutate(joinSpace, { spaceId: 'room-1' });
      await world.assertConverged();
      await waitForTopics(world, 'alice', (t) =>
        t.includes(roomTopic('room-1'))
      );
      const remakes = a.pubsubRemakeCount();

      await a.mutate(leaveSpace, { spaceId: 'room-1' });
      await b.mutate(setSpaceNote, {
        id: 'n-during-leave',
        spaceId: 'room-1',
        body: 'created-while-leave',
      });
      await world.runFor(300);

      expect(a.pubsubRemakeCount()).toBe(remakes);
      await expectLiveNote(b.db, 'n-during-leave', {
        body: 'created-while-leave',
      });
      await expectLiveNote(world.server.db, 'n-during-leave', {
        body: 'created-while-leave',
      });

      await a.mutate(joinSpace, { spaceId: 'room-1' });
      await world.assertConverged();
      await expectLiveNote(a.db, 'n-during-leave', {
        body: 'created-while-leave',
      });
      expect(a.pubsubRemakeCount()).toBe(remakes);
    } finally {
      await world.dispose();
    }
  });
});
