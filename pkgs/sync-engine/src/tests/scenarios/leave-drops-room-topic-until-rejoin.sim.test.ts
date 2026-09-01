import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { syncFacade } from '../../sim/system';
import {
  createSpace,
  endSpace,
  expectLiveNote,
  isLiveNote,
  joinSpace,
  leaveSpace,
  roomTopic,
  SPACE_MEMBERSHIP_SESSION,
  setSpaceNote,
} from '../apps/acme';
import { acmeSystem } from '../apps/acme/system';

describe('leave drops room topic until rejoin', () => {
  test('leave drops room topic; further live does not apply until rejoin', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 806,
      knobs: {
        clientCount: 0,
      },
    });
    const world = syncFacade(host.system);
    const a = await world.addClient({
      id: 'alice',
      sessionQuery: SPACE_MEMBERSHIP_SESSION,
    });
    const b = await world.addClient({
      id: 'bob',
      sessionQuery: SPACE_MEMBERSHIP_SESSION,
    });

    await a.mutate(createSpace, { id: 'end-room', title: 'E' });
    await b.mutate(joinSpace, { spaceId: 'end-room' });
    await world.assertConverged();
    await world.until(() =>
      a.subscribedTopics().includes(roomTopic('end-room'))
    );
    const remakes = a.pubsubRemakeCount();

    await a.mutate(leaveSpace, { spaceId: 'end-room' });
    await world.until(
      () => !a.subscribedTopics().includes(roomTopic('end-room'))
    );
    expect(a.pubsubRemakeCount()).toBe(remakes);

    {
      using _hold = world.net('alice', 'sync').set('hold');
      await b.mutate(setSpaceNote, {
        id: 'after-leave',
        spaceId: 'end-room',
        body: 'miss-me',
      });
      await world.never(() => isLiveNote(a.db, 'after-leave'), { forMs: 300 });
      await expectLiveNote(b.db, 'after-leave', { body: 'miss-me' });
      expect(a.pubsubRemakeCount()).toBe(remakes);
    }
    await a.mutate(joinSpace, { spaceId: 'end-room' });
    await world.assertConverged();
    await expectLiveNote(a.db, 'after-leave', { body: 'miss-me' });
  });

  test('endSpace drops room topic without remake', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 807,
      knobs: {
        clientCount: 0,
      },
    });
    const world = syncFacade(host.system);
    const a = await world.addClient({
      id: 'alice',
      sessionQuery: SPACE_MEMBERSHIP_SESSION,
    });
    await a.mutate(createSpace, { id: 'ended', title: 'X' });
    await world.assertConverged();
    await world.until(() => a.subscribedTopics().includes(roomTopic('ended')));
    const remakes = a.pubsubRemakeCount();

    await a.mutate(endSpace, { spaceId: 'ended' });
    await world.until(() => !a.subscribedTopics().includes(roomTopic('ended')));
    expect(a.subscribedTopics()).not.toContain(roomTopic('ended'));
    expect(a.pubsubRemakeCount()).toBe(remakes);
    await world.assertConverged();
  });
});
