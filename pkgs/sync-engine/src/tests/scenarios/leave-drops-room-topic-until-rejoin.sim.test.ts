import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  createSpace,
  endSpace,
  expectConverged,
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
  untilAcme,
} from '../apps/acme';

describe('leave drops room topic until rejoin', () => {
  test('leave drops room topic; further live does not apply until rejoin', async () => {
    await using s = await acmeSystem.script({
      seed: 806,
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
      id: 'end-room',
      title: 'E',
    });
    await expectConverged(s);
    await untilAcme(s, (s) => subscribedTopics(s, 'alice'), {
      pred: hasTopic(roomTopic('end-room')),
    });
    await s.apply(mutate, 'bob', joinSpace, { spaceId: 'end-room' });
    await untilAcme(s, (s) => subscribedTopics(s, 'bob'), {
      pred: hasTopic(roomTopic('end-room')),
    });
    await expectConverged(s);
    await untilAcme(s, (s) => subscribedTopics(s, 'alice'), {
      pred: hasTopic(roomTopic('end-room')),
    });
    const remakes = await s.observe(pubsubRemakeCount, 'alice');

    await s.apply(mutate, 'alice', leaveSpace, { spaceId: 'end-room' });
    await untilAcme(s, (s) => subscribedTopics(s, 'alice'), {
      pred: lacksTopic(roomTopic('end-room')),
    });
    expect(await s.observe(pubsubRemakeCount, 'alice')).toBe(remakes);

    await s.apply(hold, 'alice', 'sync');
    await s.apply(mutate, 'bob', setSpaceNote, {
      id: 'after-leave',
      spaceId: 'end-room',
      body: 'miss-me',
    });
    await neverAcme(s, (s) => liveNote(s, 'alice', 'after-leave'), {
      forMs: 300,
      pred: noteLive,
    });
    expect(await s.observe(liveNote, 'bob', 'after-leave')).toMatchObject({
      body: 'miss-me',
    });
    expect(await s.observe(pubsubRemakeCount, 'alice')).toBe(remakes);
    await s.apply(release, 'alice', 'sync');

    await s.apply(mutate, 'alice', joinSpace, { spaceId: 'end-room' });
    await expectConverged(s);
    await expectLiveNoteAt(s, 'alice', 'after-leave', { body: 'miss-me' });
  });

  test('endSpace drops room topic without remake', async () => {
    await using s = await acmeSystem.script({
      seed: 807,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, {
      id: 'alice',
      sessionQuery: SPACE_MEMBERSHIP_SESSION,
    });
    await s.apply(mutate, 'alice', createSpace, { id: 'ended', title: 'X' });
    await expectConverged(s);
    await untilAcme(s, (s) => subscribedTopics(s, 'alice'), {
      pred: hasTopic(roomTopic('ended')),
    });
    const remakes = await s.observe(pubsubRemakeCount, 'alice');

    await s.apply(mutate, 'alice', endSpace, { spaceId: 'ended' });
    await untilAcme(s, (s) => subscribedTopics(s, 'alice'), {
      pred: lacksTopic(roomTopic('ended')),
    });
    expect(await s.observe(subscribedTopics, 'alice')).not.toContain(
      roomTopic('ended')
    );
    expect(await s.observe(pubsubRemakeCount, 'alice')).toBe(remakes);
    await expectConverged(s);
  });
});
