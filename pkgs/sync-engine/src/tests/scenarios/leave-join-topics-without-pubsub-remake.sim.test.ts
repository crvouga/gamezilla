import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeDraws,
  acmeSystem,
  addClient,
  createSpace,
  expectConverged,
  hasTopic,
  joinSpace,
  lacksTopic,
  leaveSpace,
  mutate,
  passTime,
  pubsubRemakeCount,
  roomTopic,
  SPACE_MEMBERSHIP_SESSION,
  subscribedTopics,
  syncVirtualHost,
  untilAcme,
  userTopic,
} from '../apps/acme';

describe('leave join topics without pubsub remake', () => {
  test('leave then join different room without pubsub remake', async () => {
    await using run = await start(acmeSystem, {
      seed: 801,
      host: syncVirtualHost(),
      draws: acmeDraws({
        clientCount: 0,
      }),
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
      id: 'space-a',
      title: 'A',
    });
    await run.apply(mutate, 'bob', joinSpace, { spaceId: 'space-a' });
    await expectConverged(run);

    await untilAcme(run, subscribedTopics('alice'), {
      pred: hasTopic(roomTopic('space-a')),
    });
    const topicsA = await run.observe(subscribedTopics('alice'));
    expect(topicsA).toContain(userTopic('alice'));
    expect(topicsA).toContain(roomTopic('space-a'));
    const remakesAfterJoin = await run.observe(pubsubRemakeCount('alice'));

    await run.apply(mutate, 'alice', leaveSpace, { spaceId: 'space-a' });
    await run.apply(passTime, 200);
    await untilAcme(run, subscribedTopics('alice'), {
      pred: lacksTopic(roomTopic('space-a')),
    });
    expect(await run.observe(pubsubRemakeCount('alice'))).toBe(
      remakesAfterJoin
    );

    await run.apply(mutate, 'alice', createSpace, {
      id: 'space-b',
      title: 'B',
    });
    await run.apply(passTime, 200);
    await untilAcme(run, subscribedTopics('alice'), {
      pred: hasTopic(roomTopic('space-b')),
    });
    const topicsB = await run.observe(subscribedTopics('alice'));
    expect(topicsB).toContain(roomTopic('space-b'));
    expect(topicsB).not.toContain(roomTopic('space-a'));
    expect(await run.observe(pubsubRemakeCount('alice'))).toBe(
      remakesAfterJoin
    );

    await expectConverged(run);
  });
});
