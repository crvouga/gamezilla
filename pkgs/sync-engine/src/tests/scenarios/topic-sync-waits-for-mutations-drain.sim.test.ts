import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  createSpace,
  expectConverged,
  hasTopic,
  hold,
  lacksTopic,
  leaveSpace,
  mutate,
  passTime,
  release,
  roomTopic,
  SPACE_MEMBERSHIP_SESSION,
  subscribedTopics,
  syncVirtualHost,
  untilAcme,
} from '../apps/acme';

describe('topic sync waits for mutations drain', () => {
  test('topic sync waits until pending mutations drain', async () => {
    await using run = await start(acmeSystem, {
      seed: 803,
      host: syncVirtualHost(),
      knobs: acmeKnobs({
        clientCount: 0,
      }),
      properties: [],
    });

    await run.apply(addClient, {
      id: 'alice',
      sessionQuery: SPACE_MEMBERSHIP_SESSION,
    });
    await run.apply(mutate, 'alice', createSpace, { id: 'gated', title: 'G' });
    await expectConverged(run);
    await untilAcme(run, subscribedTopics('alice'), {
      pred: hasTopic(roomTopic('gated')),
    });

    await run.apply(hold, 'alice', 'sync');
    await run.apply(mutate, 'alice', leaveSpace, { spaceId: 'gated' });
    await run.apply(passTime, 300);
    // Upload held → membership sync must not drop room topic yet.
    expect(await run.observe(subscribedTopics('alice'))).toContain(
      roomTopic('gated')
    );
    await run.apply(release, 'alice', 'sync');

    await untilAcme(run, subscribedTopics('alice'), {
      pred: lacksTopic(roomTopic('gated')),
    });
    await expectConverged(run);
  });
});
