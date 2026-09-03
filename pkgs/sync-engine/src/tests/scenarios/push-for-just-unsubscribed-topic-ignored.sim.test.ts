import { describe, test } from 'bun:test';
import { script } from '@pkgs/dst';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  createSpace,
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
  release,
  roomTopic,
  SPACE_MEMBERSHIP_SESSION,
  setSpaceNote,
  subscribedTopics,
  syncVirtualHost,
  untilAcme,
} from '../apps/acme';

describe('push for just unsubscribed topic ignored', () => {
  test('leave races room push; ignored without error; engine stays healthy', async () => {
    await using run = await script(acmeSystem, {
      seed: 812,
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
      id: 'race-room',
      title: 'R',
    });
    await expectConverged(run);
    await untilAcme(run, subscribedTopics('alice'), {
      pred: hasTopic(roomTopic('race-room')),
    });
    await run.apply(mutate, 'bob', joinSpace, { spaceId: 'race-room' });
    await untilAcme(run, subscribedTopics('bob'), {
      pred: hasTopic(roomTopic('race-room')),
    });
    await expectConverged(run);
    await untilAcme(run, subscribedTopics('alice'), {
      pred: hasTopic(roomTopic('race-room')),
    });

    await run.apply(mutate, 'alice', leaveSpace, { spaceId: 'race-room' });
    await untilAcme(run, subscribedTopics('alice'), {
      pred: lacksTopic(roomTopic('race-room')),
    });

    await run.apply(hold, 'alice', 'sync');
    await run.apply(mutate, 'bob', setSpaceNote, {
      id: 'late-push',
      spaceId: 'race-room',
      body: 'missed',
    });
    await neverAcme(run, liveNote('alice', 'late-push'), {
      forMs: 300,
      pred: noteLive,
    });
    await expectLiveNoteAt(run, 'bob', 'late-push', { body: 'missed' });
    await run.apply(release, 'alice', 'sync');

    await run.apply(mutate, 'alice', joinSpace, { spaceId: 'race-room' });
    await expectConverged(run);
    await expectLiveNoteAt(run, 'alice', 'late-push', { body: 'missed' });
  });
});
