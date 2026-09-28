import { describe, expect, test } from 'bun:test';
import {
  addClient,
  createSpace,
  exampleSystem,
  expectInSync,
  expectLiveNoteAt,
  hasTopic,
  joinSpace,
  lacksTopic,
  leaveSpace,
  liveNote,
  mutate,
  neverExample,
  noteLive,
  pauseNetwork,
  pubsubRemakeCount,
  resumeNetwork,
  roomTopic,
  SPACE_MEMBERSHIP_SESSION,
  setSpaceNote,
  subscribedTopics,
  untilExample,
} from '@pkgs/sync-engine/sim';

/**
 * Leaving a space drops its live topic without reconnecting the live
 * channel, once the leave has reached the server. Kept until
 * `specs/sync/shared-space-membership.feature`'s "Leaving stops new notes
 * reaching someone whose app cannot send" says the leave was sent before the
 * app lost the ability to send (as written, the leave never reaches the
 * server, and the app keeps the topic until its queued edits drain). Ending
 * a space and opening one the person is not in are that feature's scenarios.
 */
describe('space topic scope', () => {
  test('leave drops room topic; further live does not apply until rejoin', async () => {
    await using s = await exampleSystem.run({
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
    await expectInSync(s);
    await untilExample(s, (s) => subscribedTopics(s, 'alice'), {
      pred: hasTopic(roomTopic('end-room')),
    });
    await s.apply(mutate, 'bob', joinSpace, { spaceId: 'end-room' });
    await untilExample(s, (s) => subscribedTopics(s, 'bob'), {
      pred: hasTopic(roomTopic('end-room')),
    });
    await expectInSync(s);
    await untilExample(s, (s) => subscribedTopics(s, 'alice'), {
      pred: hasTopic(roomTopic('end-room')),
    });
    const remakes = await s.read(pubsubRemakeCount, 'alice');

    await s.apply(mutate, 'alice', leaveSpace, { spaceId: 'end-room' });
    await untilExample(s, (s) => subscribedTopics(s, 'alice'), {
      pred: lacksTopic(roomTopic('end-room')),
    });
    expect(await s.read(pubsubRemakeCount, 'alice')).toBe(remakes);

    await s.apply(pauseNetwork, 'alice', 'sync');
    await s.apply(mutate, 'bob', setSpaceNote, {
      id: 'after-leave',
      spaceId: 'end-room',
      body: 'miss-me',
    });
    await neverExample(s, (s) => liveNote(s, 'alice', 'after-leave'), {
      forMs: 300,
      pred: noteLive,
    });
    expect(await s.read(liveNote, 'bob', 'after-leave')).toMatchObject({
      body: 'miss-me',
    });
    expect(await s.read(pubsubRemakeCount, 'alice')).toBe(remakes);
    await s.apply(resumeNetwork, 'alice', 'sync');

    await s.apply(mutate, 'alice', joinSpace, { spaceId: 'end-room' });
    await expectInSync(s);
    await expectLiveNoteAt(s, 'alice', 'after-leave', { body: 'miss-me' });
  });
});
