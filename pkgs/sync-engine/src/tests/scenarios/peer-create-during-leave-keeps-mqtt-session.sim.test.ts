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
  leaveSpace,
  liveNote,
  mutate,
  passTime,
  pubsubRemakeCount,
  roomTopic,
  SPACE_MEMBERSHIP_SESSION,
  setSpaceNote,
  subscribedTopics,
  syncVirtualHost,
  untilAcme,
} from '../apps/acme';

describe('peer create during leave keeps mqtt session', () => {
  test('peer create during leave does not remake MQTT; rejoin hydrates', async () => {
    await using run = await script(acmeSystem, {
      seed: 802,
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

    await run.apply(mutate, 'alice', createSpace, { id: 'room-1', title: 'R' });
    await expectConverged(run);
    await untilAcme(run, subscribedTopics('alice'), {
      pred: hasTopic(roomTopic('room-1')),
    });
    await run.apply(mutate, 'bob', joinSpace, { spaceId: 'room-1' });
    await untilAcme(run, subscribedTopics('bob'), {
      pred: hasTopic(roomTopic('room-1')),
    });
    await expectConverged(run);
    await untilAcme(run, subscribedTopics('alice'), {
      pred: hasTopic(roomTopic('room-1')),
    });
    const remakes = await run.observe(pubsubRemakeCount('alice'));

    await run.apply(mutate, 'alice', leaveSpace, { spaceId: 'room-1' });
    await run.apply(mutate, 'bob', setSpaceNote, {
      id: 'n-during-leave',
      spaceId: 'room-1',
      body: 'created-while-leave',
    });
    await run.apply(passTime, 300);

    expect(await run.observe(pubsubRemakeCount('alice'))).toBe(remakes);
    expect(await run.observe(liveNote('bob', 'n-during-leave'))).toMatchObject({
      body: 'created-while-leave',
    });
    expect(
      await run.observe(liveNote('server', 'n-during-leave'))
    ).toMatchObject({ body: 'created-while-leave' });

    await run.apply(mutate, 'alice', joinSpace, { spaceId: 'room-1' });
    await expectConverged(run);
    expect(
      await run.observe(liveNote('alice', 'n-during-leave'))
    ).toMatchObject({ body: 'created-while-leave' });
    expect(await run.observe(pubsubRemakeCount('alice'))).toBe(remakes);
  });
});
