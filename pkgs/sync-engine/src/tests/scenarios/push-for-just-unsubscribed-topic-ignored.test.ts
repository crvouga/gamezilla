import { describe, test } from 'bun:test';
import {
  createSpace,
  expectLiveNote,
  expectNoteNotLive,
  joinSpace,
  leaveSpace,
  notesDomainPack,
  roomTopic,
  SPACE_MEMBERSHIP_SESSION,
  setSpaceNote,
} from '../../domain-packs/notes-app';
import { RELIABLE_FAULTS } from '../../sim/faults';
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

describe('push for just unsubscribed topic ignored', () => {
  test('leave races room push; ignored without error; engine stays healthy', async () => {
    const world = await openSimWorld({
      domain: notesDomainPack,
      seed: 812,
      faults: RELIABLE_FAULTS,
    });
    try {
      const a = await world.addClient({
        id: 'alice',
        sessionQuery: SPACE_MEMBERSHIP_SESSION,
      });
      const b = await world.addClient({
        id: 'bob',
        sessionQuery: SPACE_MEMBERSHIP_SESSION,
      });

      await a.mutate(createSpace, { id: 'race-room', title: 'R' });
      await b.mutate(joinSpace, { spaceId: 'race-room' });
      await world.assertConverged();
      await waitForTopics(world, 'alice', (t) =>
        t.includes(roomTopic('race-room'))
      );

      await a.mutate(leaveSpace, { spaceId: 'race-room' });
      await waitForTopics(
        world,
        'alice',
        (t) => !t.includes(roomTopic('race-room'))
      );

      world.hold('alice', 'sync');
      await b.mutate(setSpaceNote, {
        id: 'late-push',
        spaceId: 'race-room',
        body: 'missed',
      });
      await world.runFor(300);
      await expectNoteNotLive(a.db, 'late-push');
      await expectLiveNote(b.db, 'late-push', { body: 'missed' });

      world.release('alice', 'sync');
      await a.mutate(joinSpace, { spaceId: 'race-room' });
      await world.assertConverged();
      await expectLiveNote(a.db, 'late-push', { body: 'missed' });
    } finally {
      await world.dispose();
    }
  });
});
