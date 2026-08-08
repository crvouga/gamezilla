import { describe, test } from 'bun:test';

import { RELIABLE_FAULTS } from '../../sim/faults';
import {
  createSpace,
  expectLiveNote,
  expectNoteNotLive,
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

describe('room live isolated until member joins', () => {
  test('live on room-B does not reach alice in room-A until join', async () => {
    const world = await openSimWorld({ seed: 804, faults: RELIABLE_FAULTS });
    try {
      const a = await world.addClient({
        id: 'alice',
        sessionQuery: SPACE_MEMBERSHIP_SESSION,
      });
      const b = await world.addClient({
        id: 'bob',
        sessionQuery: SPACE_MEMBERSHIP_SESSION,
      });

      await a.mutate(createSpace, { id: 'room-a', title: 'A' });
      await b.mutate(createSpace, { id: 'room-b', title: 'B' });
      await world.runFor(300);
      await waitForTopics(world, 'alice', (t) =>
        t.includes(roomTopic('room-a'))
      );
      await waitForTopics(world, 'bob', (t) => t.includes(roomTopic('room-b')));

      await b.mutate(setSpaceNote, {
        id: 'b-only',
        spaceId: 'room-b',
        body: 'secret-b',
      });
      await world.runFor(300);
      await expectNoteNotLive(a.db, 'b-only');
      await expectLiveNote(b.db, 'b-only', { body: 'secret-b' });

      await a.mutate(joinSpace, { spaceId: 'room-b' });
      await waitForTopics(world, 'alice', (t) =>
        t.includes(roomTopic('room-b'))
      );
      await world.assertConverged();
      await expectLiveNote(a.db, 'b-only', { body: 'secret-b' });
    } finally {
      await world.dispose();
    }
  });
});
