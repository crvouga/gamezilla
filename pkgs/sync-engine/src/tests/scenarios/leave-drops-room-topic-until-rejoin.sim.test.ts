import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeDraws,
  acmeSystem,
  addClient,
  converge,
  createSpace,
  endSpace,
  expectLiveNoteAt,
  hasTopic,
  hold,
  joinSpace,
  lacksTopic,
  leaveSpace,
  liveNote,
  mutate,
  neverAcme,
  noteLive,
  pubsubRemakeCount,
  release,
  roomTopic,
  SPACE_MEMBERSHIP_SESSION,
  setSpaceNote,
  subscribedTopics,
  syncVirtualHost,
  untilAcme,
} from '../apps/acme';

describe('leave drops room topic until rejoin', () => {
  test('leave drops room topic; further live does not apply until rejoin', async () => {
    await using run = await start(acmeSystem, {
      seed: 806,
      host: syncVirtualHost(),
      draws: acmeDraws({ clientCount: 0 }),
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
      id: 'end-room',
      title: 'E',
    });
    await run.apply(converge);
    await untilAcme(run, subscribedTopics('alice'), {
      pred: hasTopic(roomTopic('end-room')),
    });
    await run.apply(mutate, 'bob', joinSpace, { spaceId: 'end-room' });
    await untilAcme(run, subscribedTopics('bob'), {
      pred: hasTopic(roomTopic('end-room')),
    });
    await run.apply(converge);
    await untilAcme(run, subscribedTopics('alice'), {
      pred: hasTopic(roomTopic('end-room')),
    });
    const remakes = await run.observe(pubsubRemakeCount('alice'));

    await run.apply(mutate, 'alice', leaveSpace, { spaceId: 'end-room' });
    await untilAcme(run, subscribedTopics('alice'), {
      pred: lacksTopic(roomTopic('end-room')),
    });
    expect(await run.observe(pubsubRemakeCount('alice'))).toBe(remakes);

    await run.apply(hold, 'alice', 'sync');
    await run.apply(mutate, 'bob', setSpaceNote, {
      id: 'after-leave',
      spaceId: 'end-room',
      body: 'miss-me',
    });
    await neverAcme(run, liveNote('alice', 'after-leave'), {
      forMs: 300,
      pred: noteLive,
    });
    expect(await run.observe(liveNote('bob', 'after-leave'))).toMatchObject({
      body: 'miss-me',
    });
    expect(await run.observe(pubsubRemakeCount('alice'))).toBe(remakes);
    await run.apply(release, 'alice', 'sync');

    await run.apply(mutate, 'alice', joinSpace, { spaceId: 'end-room' });
    await run.apply(converge);
    await expectLiveNoteAt(run, 'alice', 'after-leave', { body: 'miss-me' });
  });

  test('endSpace drops room topic without remake', async () => {
    await using run = await start(acmeSystem, {
      seed: 807,
      host: syncVirtualHost(),
      draws: acmeDraws({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, {
      id: 'alice',
      sessionQuery: SPACE_MEMBERSHIP_SESSION,
    });
    await run.apply(mutate, 'alice', createSpace, { id: 'ended', title: 'X' });
    await run.apply(converge);
    await untilAcme(run, subscribedTopics('alice'), {
      pred: hasTopic(roomTopic('ended')),
    });
    const remakes = await run.observe(pubsubRemakeCount('alice'));

    await run.apply(mutate, 'alice', endSpace, { spaceId: 'ended' });
    await untilAcme(run, subscribedTopics('alice'), {
      pred: lacksTopic(roomTopic('ended')),
    });
    expect(await run.observe(subscribedTopics('alice'))).not.toContain(
      roomTopic('ended')
    );
    expect(await run.observe(pubsubRemakeCount('alice'))).toBe(remakes);
    await run.apply(converge);
  });
});
