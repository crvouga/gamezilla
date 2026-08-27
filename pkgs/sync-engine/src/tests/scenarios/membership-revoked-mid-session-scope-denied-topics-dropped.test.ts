import { describe, expect, test } from 'bun:test';
import { openSimWorld } from '../../sim/world';
import {
  acmeDomainPack,
  createSpace,
  expectLiveNote,
  joinSpace,
  leaveSpace,
  roomTopic,
  SPACE_MEMBERSHIP_SESSION,
  setSpaceNote,
} from '../apps/acme';

describe('membership revoked mid session scope denied topics dropped', () => {
  test('leave drops room topic; previously hydrated domain rows retained', async () => {
    await using world = await openSimWorld({
      domain: acmeDomainPack,
      seed: 970,
    });
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
    await world.until(() =>
      b.subscribedTopics().includes(roomTopic('revoked-room'))
    );

    await b.mutate(setSpaceNote, {
      id: 'kept-local',
      spaceId: 'revoked-room',
      body: 'retain-me',
    });
    await world.assertConverged();
    await expectLiveNote(b.db, 'kept-local', { body: 'retain-me' });

    await b.mutate(leaveSpace, { spaceId: 'revoked-room' });
    await world.until(
      () => !b.subscribedTopics().includes(roomTopic('revoked-room'))
    );
    // nudge: confirm leave detach keeps domain rows after refetch
    await world.until(b.nudge());

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
  });

  test.each([971, 972, 973])(
    'seed sweep leave drops room topic (seed=%i)',
    async (seed) => {
      await using world = await openSimWorld({
        domain: acmeDomainPack,
        seed,
      });
      const a = await world.addClient({
        id: 'alice',
        sessionQuery: SPACE_MEMBERSHIP_SESSION,
      });
      await a.mutate(createSpace, { id: `r-${seed}`, title: 'T' });
      await world.until(() =>
        a.subscribedTopics().includes(roomTopic(`r-${seed}`))
      );
      await a.mutate(leaveSpace, { spaceId: `r-${seed}` });
      await world.until(
        () => !a.subscribedTopics().includes(roomTopic(`r-${seed}`))
      );
      expect(a.subscribedTopics()).not.toContain(roomTopic(`r-${seed}`));
    }
  );
});
