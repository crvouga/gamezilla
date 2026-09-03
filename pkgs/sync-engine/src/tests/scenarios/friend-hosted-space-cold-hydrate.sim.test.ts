import { describe, test } from 'bun:test';
import { script } from '@pkgs/dst';
import {
  acmeKnobs,
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
  syncVirtualHost,
  untilAcme,
} from '../apps/acme';

describe('friend hosted space cold hydrate', () => {
  test('friend sees host space via push and again after wipe restart', async () => {
    await using run = await script(acmeSystem, {
      seed: 910,
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

    await run.apply(mutate, 'alice', befriend, { peerId: 'bob' });
    await expectConverged(run);

    await run.apply(mutate, 'alice', createSpace, {
      id: 'friend-space',
      title: 'Alice lobby',
    });

    // Phase A — live push via friend topic wake (product: new space appears).
    await untilAcme(run, liveSpace('bob', 'friend-space'));
    await expectLiveSpaceAt(run, 'bob', 'friend-space', {
      title: 'Alice lobby',
      ownerId: 'alice',
    });

    // Phase B — cold hydrate after wipe (product bug without query widen).
    await run.apply(crash, 'bob');
    await run.apply(restart, 'bob', {});
    await untilAcme(run, liveSpace('bob', 'friend-space'));
    await expectLiveSpaceAt(run, 'bob', 'friend-space', {
      title: 'Alice lobby',
      ownerId: 'alice',
    });
  });
});
