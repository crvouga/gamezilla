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
  liveNote,
  mutate,
  neverAcme,
  noteLive,
  roomTopic,
  SPACE_MEMBERSHIP_SESSION,
  setSpaceNote,
  subscribedTopics,
  syncVirtualHost,
  untilAcme,
} from '../apps/acme';

describe('room live isolated until member joins', () => {
  test('live on room-B does not reach alice in room-A until join', async () => {
    await using run = await script(acmeSystem, {
      seed: 804,
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

    await run.apply(mutate, 'alice', createSpace, { id: 'room-a', title: 'A' });
    await run.apply(mutate, 'bob', createSpace, { id: 'room-b', title: 'B' });
    await untilAcme(run, (s) => subscribedTopics(s, 'alice'), {
      pred: hasTopic(roomTopic('room-a')),
    });
    await untilAcme(run, (s) => subscribedTopics(s, 'bob'), {
      pred: hasTopic(roomTopic('room-b')),
    });

    await run.apply(mutate, 'bob', setSpaceNote, {
      id: 'b-only',
      spaceId: 'room-b',
      body: 'secret-b',
    });
    await neverAcme(run, (s) => liveNote(s, 'alice', 'b-only'), {
      forMs: 300,
      pred: noteLive,
    });
    expect(await run.observe(liveNote, 'bob', 'b-only')).toMatchObject({
      body: 'secret-b',
    });

    await run.apply(mutate, 'alice', joinSpace, { spaceId: 'room-b' });
    await untilAcme(run, (s) => subscribedTopics(s, 'alice'), {
      pred: hasTopic(roomTopic('room-b')),
    });
    await expectConverged(run);
    expect(await run.observe(liveNote, 'alice', 'b-only')).toMatchObject({
      body: 'secret-b',
    });
  });
});
