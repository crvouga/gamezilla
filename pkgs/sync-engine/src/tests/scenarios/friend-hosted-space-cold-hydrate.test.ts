import { describe, expect, test } from 'bun:test';
import {
  befriend,
  createSpace,
  expectLiveSpace,
  isLiveSpace,
  acmeDomainPack,
  SPACE_MEMBERSHIP_SESSION,
} from '../apps/acme';
import { openSimWorld } from '../../sim/world';

describe('friend hosted space cold hydrate', () => {
  test('friend sees host space via push and again after wipe restart', async () => {
    await using world = await openSimWorld({
      domain: acmeDomainPack,
      sessionQuery: SPACE_MEMBERSHIP_SESSION,
      seed: 910,
    });
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
