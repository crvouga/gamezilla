import { describe, test } from 'bun:test';

import { RELIABLE_FAULTS } from '../../sim/faults';
import {
  createSpace,
  expectLiveNote,
  joinSpace,
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

describe('membership join live', () => {
  test('after join, peer space note paints via live while sync held', async () => {
    const world = await openSimWorld({ seed: 805, faults: RELIABLE_FAULTS });
    try {
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
      await waitForTopics(world, 'alice', (t) =>
        t.includes(roomTopic('live-room'))
      );

      await b.mutate(joinSpace, { spaceId: 'live-room' });
      await waitForTopics(world, 'bob', (t) =>
        t.includes(roomTopic('live-room'))
      );

      world.hold('alice', 'sync');
      await b.mutate(setSpaceNote, {
        id: 'via-live',
        spaceId: 'live-room',
        body: 'from-bob',
      });
      await world.runFor(300);
      await expectLiveNote(a.db, 'via-live', { body: 'from-bob' });

      world.release('alice', 'sync');
      await world.assertConverged();
    } finally {
      await world.dispose();
    }
  });
});
