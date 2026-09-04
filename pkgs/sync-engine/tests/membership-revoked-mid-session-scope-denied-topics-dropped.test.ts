import { describe, expect, test } from 'bun:test';
import {
  addClient,
  createSpace,
  exampleSystem,
  expectInSync,
  hasTopic,
  joinSpace,
  lacksTopic,
  leaveSpace,
  liveNote,
  mutate,
  nudge,
  roomTopic,
  SPACE_MEMBERSHIP_SESSION,
  setSpaceNote,
  subscribedTopics,
  untilExample,
} from '@pkgs/sync-engine/sim';

describe('membership revoked mid session scope denied topics dropped', () => {
  test('leave drops room topic; previously hydrated domain rows retained', async () => {
    await using s = await exampleSystem.run({
      seed: 970,
      args: { clientCount: 0 },
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
      id: 'revoked-room',
      title: 'R',
    });
    await expectInSync(s);
    await untilExample(s, (s) => subscribedTopics(s, 'alice'), {
      pred: hasTopic(roomTopic('revoked-room')),
    });
    await s.apply(mutate, 'bob', joinSpace, { spaceId: 'revoked-room' });
    await untilExample(s, (s) => subscribedTopics(s, 'bob'), {
      pred: hasTopic(roomTopic('revoked-room')),
    });
    await expectInSync(s);

    await s.apply(mutate, 'bob', setSpaceNote, {
      id: 'kept-local',
      spaceId: 'revoked-room',
      body: 'retain-me',
    });
    await expectInSync(s);
    expect(await s.read(liveNote, 'bob', 'kept-local')).toMatchObject({
      body: 'retain-me',
    });

    await s.apply(mutate, 'bob', leaveSpace, { spaceId: 'revoked-room' });
    await untilExample(s, (s) => subscribedTopics(s, 'bob'), {
      pred: lacksTopic(roomTopic('revoked-room')),
    });
    // nudge: confirm leave detach keeps domain rows after refetch
    await s.apply(nudge, 'bob');

    expect(await s.read(subscribedTopics, 'bob')).not.toContain(
      roomTopic('revoked-room')
    );
    // Domain rows retained after membership detach (no wipe on deny/leave).
    expect(await s.read(liveNote, 'bob', 'kept-local')).toMatchObject({
      body: 'retain-me',
    });

    await s.apply(mutate, 'alice', setSpaceNote, {
      id: 'after-leave',
      spaceId: 'revoked-room',
      body: 'miss',
    });
    await s.advanceTime(300);
    // Intentionally not inSync: bob is out of room scope.
    expect(await s.read(liveNote, 'alice', 'after-leave')).toMatchObject({
      body: 'miss',
    });
  });

  test.each([971, 972, 973])(
    'seed sweep leave drops room topic (seed=%i)',
    async (seed) => {
      await using s = await exampleSystem.run({
        seed: seed,
        args: { clientCount: 0 },
      });

      await s.apply(addClient, {
        id: 'alice',
        sessionQuery: SPACE_MEMBERSHIP_SESSION,
      });
      await s.apply(mutate, 'alice', createSpace, {
        id: `r-${seed}`,
        title: 'T',
      });
      await untilExample(s, (s) => subscribedTopics(s, 'alice'), {
        pred: hasTopic(roomTopic(`r-${seed}`)),
      });
      await s.apply(mutate, 'alice', leaveSpace, { spaceId: `r-${seed}` });
      await untilExample(s, (s) => subscribedTopics(s, 'alice'), {
        pred: lacksTopic(roomTopic(`r-${seed}`)),
      });
      expect(await s.read(subscribedTopics, 'alice')).not.toContain(
        roomTopic(`r-${seed}`)
      );
    }
  );
});
