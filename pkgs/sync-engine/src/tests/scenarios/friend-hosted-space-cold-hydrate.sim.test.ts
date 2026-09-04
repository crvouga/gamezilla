import { describe, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  befriend,
  crash,
  createSpace,
  expectConverged,
  expectLiveSpaceAt,
  liveSpace,
  mutate,
  restart,
  SPACE_MEMBERSHIP_SESSION,
  untilAcme,
} from '../apps/acme';

describe('friend hosted space cold hydrate', () => {
  test('friend sees host space via push and again after wipe restart', async () => {
    await using s = await acmeSystem.script({
      seed: 910,
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

    await s.apply(mutate, 'alice', befriend, { peerId: 'bob' });
    await expectConverged(s);

    await s.apply(mutate, 'alice', createSpace, {
      id: 'friend-space',
      title: 'Alice lobby',
    });

    // Phase A — live push via friend topic wake (product: new space appears).
    await untilAcme(s, (s) => liveSpace(s, 'bob', 'friend-space'));
    await expectLiveSpaceAt(s, 'bob', 'friend-space', {
      title: 'Alice lobby',
      ownerId: 'alice',
    });

    // Phase B — cold hydrate after wipe (product bug without query widen).
    await s.apply(crash, 'bob');
    await s.apply(restart, 'bob', {});
    await untilAcme(s, (s) => liveSpace(s, 'bob', 'friend-space'));
    await expectLiveSpaceAt(s, 'bob', 'friend-space', {
      title: 'Alice lobby',
      ownerId: 'alice',
    });
  });
});
