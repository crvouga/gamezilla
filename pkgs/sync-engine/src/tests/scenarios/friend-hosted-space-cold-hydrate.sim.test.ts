import { openWorld } from '@pkgs/determinism';
import { acmeSystem } from '../apps/acme/system';
import { syncFacade } from '../../sim/system';
import { describe, expect, test } from 'bun:test';
import { befriend, createSpace, expectLiveSpace, isLiveSpace, SPACE_MEMBERSHIP_SESSION } from '../apps/acme';

describe('friend hosted space cold hydrate', () => {
  test('friend sees host space via push and again after wipe restart', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 910,
      knobs: {
        clientCount: 0,
      },
    });
    const world = syncFacade(host.system);
    const alice = await world.addClient({
      id: 'alice',
      sessionQuery: SPACE_MEMBERSHIP_SESSION,
    });
    const bob = await world.addClient({
      id: 'bob',
      sessionQuery: SPACE_MEMBERSHIP_SESSION,
    });

    await alice.mutate(befriend, { peerId: 'bob' });
    await world.assertConverged();

    await alice.mutate(createSpace, {
      id: 'friend-space',
      title: 'Alice lobby',
    });

    // Phase A — live push via friend topic wake (product: new space appears).
    await world.until(() => isLiveSpace(bob.db, 'friend-space'));
    await expectLiveSpace(bob.db, 'friend-space', {
      title: 'Alice lobby',
      owner_id: 'alice',
    });

    // Phase B — cold hydrate after wipe (product bug without query widen).
    await world.node('bob').crash();
    const bob2 = await world.node('bob').restart();
    expect(bob2).toBeDefined();
    await world.until(() => isLiveSpace(bob2!.db, 'friend-space'));
    await expectLiveSpace(bob2!.db, 'friend-space', {
      title: 'Alice lobby',
      owner_id: 'alice',
    });
  });
});
