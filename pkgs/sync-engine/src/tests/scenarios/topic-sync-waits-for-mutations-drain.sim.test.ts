import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  createSpace,
  expectConverged,
  hasTopic,
  hold,
  lacksTopic,
  leaveSpace,
  mutate,
  release,
  roomTopic,
  SPACE_MEMBERSHIP_SESSION,
  subscribedTopics,
  untilAcme,
} from '../apps/acme';

describe('topic sync waits for mutations drain', () => {
  test('topic sync waits until pending mutations drain', async () => {
    await using s = await acmeSystem.script({
      seed: 803,
      args: {
        clientCount: 0,
      },
    });

    await s.apply(addClient, {
      id: 'alice',
      sessionQuery: SPACE_MEMBERSHIP_SESSION,
    });
    await s.apply(mutate, 'alice', createSpace, { id: 'gated', title: 'G' });
    await expectConverged(s);
    await untilAcme(s, (s) => subscribedTopics(s, 'alice'), {
      pred: hasTopic(roomTopic('gated')),
    });

    await s.apply(hold, 'alice', 'sync');
    await s.apply(mutate, 'alice', leaveSpace, { spaceId: 'gated' });
    await s.elapse(300);
    // Upload held → membership sync must not drop room topic yet.
    expect(await s.observe(subscribedTopics, 'alice')).toContain(
      roomTopic('gated')
    );
    await s.apply(release, 'alice', 'sync');

    await untilAcme(s, (s) => subscribedTopics(s, 'alice'), {
      pred: lacksTopic(roomTopic('gated')),
    });
    await expectConverged(s);
  });
});
