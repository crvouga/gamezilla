import { describe, expect, test } from 'bun:test';
import { script } from '@pkgs/dst';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  createSpace,
  expectConverged,
  hasTopic,
  joinSpace,
  lacksTopic,
  leaveSpace,
  liveNote,
  mutate,
  nudge,
  passTime,
  roomTopic,
  SPACE_MEMBERSHIP_SESSION,
  setSpaceNote,
  subscribedTopics,
  syncVirtualHost,
  untilAcme,
} from '../apps/acme';

describe('membership revoked mid session scope denied topics dropped', () => {
  test('leave drops room topic; previously hydrated domain rows retained', async () => {
    await using run = await script(acmeSystem, {
      seed: 970,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, {
      id: 'alice',
      sessionQuery: SPACE_MEMBERSHIP_SESSION,
    });
    await run.apply(addClient, {
      id: 'bob',
      sessionQuery: SPACE_MEMBERSHIP_SESSION,
    });

    await run.apply(mutate, 'alice', createSpace, {
      id: 'revoked-room',
      title: 'R',
    });
    await expectConverged(run);
    await untilAcme(run, subscribedTopics('alice'), {
      pred: hasTopic(roomTopic('revoked-room')),
    });
    await run.apply(mutate, 'bob', joinSpace, { spaceId: 'revoked-room' });
    await untilAcme(run, subscribedTopics('bob'), {
      pred: hasTopic(roomTopic('revoked-room')),
    });
    await expectConverged(run);

    await run.apply(mutate, 'bob', setSpaceNote, {
      id: 'kept-local',
      spaceId: 'revoked-room',
      body: 'retain-me',
    });
    await expectConverged(run);
    expect(await run.observe(liveNote('bob', 'kept-local'))).toMatchObject({
      body: 'retain-me',
    });

    await run.apply(mutate, 'bob', leaveSpace, { spaceId: 'revoked-room' });
    await untilAcme(run, subscribedTopics('bob'), {
      pred: lacksTopic(roomTopic('revoked-room')),
    });
    // nudge: confirm leave detach keeps domain rows after refetch
    await run.apply(nudge, 'bob');

    expect(await run.observe(subscribedTopics('bob'))).not.toContain(
      roomTopic('revoked-room')
    );
    // Domain rows retained after membership detach (no wipe on deny/leave).
    expect(await run.observe(liveNote('bob', 'kept-local'))).toMatchObject({
      body: 'retain-me',
    });

    await run.apply(mutate, 'alice', setSpaceNote, {
      id: 'after-leave',
      spaceId: 'revoked-room',
      body: 'miss',
    });
    await run.apply(passTime, 300);
    // Intentionally not converged: bob is out of room scope.
    expect(await run.observe(liveNote('alice', 'after-leave'))).toMatchObject({
      body: 'miss',
    });
  });

  test.each([971, 972, 973])(
    'seed sweep leave drops room topic (seed=%i)',
    async (seed) => {
      await using run = await script(acmeSystem, {
        seed: seed,
        host: syncVirtualHost(),
        knobs: acmeKnobs({ clientCount: 0 }),
        properties: [],
      });

      await run.apply(addClient, {
        id: 'alice',
        sessionQuery: SPACE_MEMBERSHIP_SESSION,
      });
      await run.apply(mutate, 'alice', createSpace, {
        id: `r-${seed}`,
        title: 'T',
      });
      await untilAcme(run, subscribedTopics('alice'), {
        pred: hasTopic(roomTopic(`r-${seed}`)),
      });
      await run.apply(mutate, 'alice', leaveSpace, { spaceId: `r-${seed}` });
      await untilAcme(run, subscribedTopics('alice'), {
        pred: lacksTopic(roomTopic(`r-${seed}`)),
      });
      expect(await run.observe(subscribedTopics('alice'))).not.toContain(
        roomTopic(`r-${seed}`)
      );
    }
  );
});
