import { describe, expect, test } from 'bun:test';
import {
  createSpace,
  expectLiveNote,
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

async function pump(
  world: SimWorld,
  work: Promise<unknown>,
  maxVirtualMs = 2_000
): Promise<void> {
  let done = false;
  const tracked = Promise.resolve(work).finally(() => {
    done = true;
  });
  const steps = Math.ceil(maxVirtualMs / 25);
  for (let i = 0; i < steps && !done; i += 1) {
    await world.runFor(25);
  }
  await tracked;
}

describe('membership revoked mid session scope denied topics dropped', () => {
  test('leave drops room topic; previously hydrated domain rows retained', async () => {
    const world = await openSimWorld({
      domain: notesDomainPack,
      seed: 970,
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

      await a.mutate(createSpace, { id: 'revoked-room', title: 'R' });
      await b.mutate(joinSpace, { spaceId: 'revoked-room' });
      await world.assertConverged();
      await waitForTopics(world, 'bob', (t) =>
        t.includes(roomTopic('revoked-room'))
      );

      await b.mutate(setSpaceNote, {
        id: 'kept-local',
        spaceId: 'revoked-room',
        body: 'retain-me',
      });
      await world.assertConverged();
      await expectLiveNote(b.db, 'kept-local', { body: 'retain-me' });

      await b.mutate(leaveSpace, { spaceId: 'revoked-room' });
      await waitForTopics(
        world,
        'bob',
        (t) => !t.includes(roomTopic('revoked-room'))
      );
      await pump(world, b.engine.refreshQueries());

      expect(b.subscribedTopics()).not.toContain(roomTopic('revoked-room'));
      // Domain rows retained after membership detach (no wipe on deny/leave).
      await expectLiveNote(b.db, 'kept-local', { body: 'retain-me' });

      await a.mutate(setSpaceNote, {
        id: 'after-leave',
        spaceId: 'revoked-room',
        body: 'miss',
      });
      await world.runFor(300);
      // Intentionally not assertConverged: bob is out of room scope.
      await expectLiveNote(a.db, 'after-leave', { body: 'miss' });
    } finally {
      await world.dispose();
    }
  });

  test('seed sweep leave drops room topic', async () => {
    for (const seed of [971, 972, 973] as const) {
      const world = await openSimWorld({
        domain: notesDomainPack,
        seed,
        faults: RELIABLE_FAULTS,
      });
      try {
        const a = await world.addClient({
          id: 'alice',
          sessionQuery: SPACE_MEMBERSHIP_SESSION,
        });
        await a.mutate(createSpace, { id: `r-${seed}`, title: 'T' });
        await waitForTopics(world, 'alice', (t) =>
          t.includes(roomTopic(`r-${seed}`))
        );
        await a.mutate(leaveSpace, { spaceId: `r-${seed}` });
        const topics = await waitForTopics(
          world,
          'alice',
          (t) => !t.includes(roomTopic(`r-${seed}`))
        );
        expect(topics).not.toContain(roomTopic(`r-${seed}`));
      } finally {
        await world.dispose();
      }
    }
  });
});
