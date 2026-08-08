import { describe, expect, test } from 'bun:test';
import {
  createSpace,
  endSpace,
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

describe('leave drops room topic until rejoin', () => {
  test('leave drops room topic; further live does not apply until rejoin', async () => {
    const world = await openSimWorld({
      domain: notesDomainPack,
      seed: 806,
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

      await a.mutate(createSpace, { id: 'end-room', title: 'E' });
      await b.mutate(joinSpace, { spaceId: 'end-room' });
      await world.assertConverged();
      await waitForTopics(world, 'alice', (t) =>
        t.includes(roomTopic('end-room'))
      );
      const remakes = a.pubsubRemakeCount();

      await a.mutate(leaveSpace, { spaceId: 'end-room' });
      await waitForTopics(
        world,
        'alice',
        (t) => !t.includes(roomTopic('end-room'))
      );
      expect(a.pubsubRemakeCount()).toBe(remakes);

      world.hold('alice', 'sync');
      await b.mutate(setSpaceNote, {
        id: 'after-leave',
        spaceId: 'end-room',
        body: 'miss-me',
      });
      await world.runFor(300);
      await expectNoteNotLive(a.db, 'after-leave');
      await expectLiveNote(b.db, 'after-leave', { body: 'miss-me' });
      expect(a.pubsubRemakeCount()).toBe(remakes);

      world.release('alice', 'sync');
      await a.mutate(joinSpace, { spaceId: 'end-room' });
      await world.assertConverged();
      await expectLiveNote(a.db, 'after-leave', { body: 'miss-me' });
    } finally {
      await world.dispose();
    }
  });

  test('endSpace drops room topic without remake', async () => {
    const world = await openSimWorld({
      domain: notesDomainPack,
      seed: 807,
      faults: RELIABLE_FAULTS,
    });
    try {
      const a = await world.addClient({
        id: 'alice',
        sessionQuery: SPACE_MEMBERSHIP_SESSION,
      });
      await a.mutate(createSpace, { id: 'ended', title: 'X' });
      await world.assertConverged();
      await waitForTopics(world, 'alice', (t) =>
        t.includes(roomTopic('ended'))
      );
      const remakes = a.pubsubRemakeCount();

      await a.mutate(endSpace, { spaceId: 'ended' });
      const topics = await waitForTopics(
        world,
        'alice',
        (t) => !t.includes(roomTopic('ended'))
      );
      expect(topics).not.toContain(roomTopic('ended'));
      expect(a.pubsubRemakeCount()).toBe(remakes);
      await world.assertConverged();
    } finally {
      await world.dispose();
    }
  });
});
