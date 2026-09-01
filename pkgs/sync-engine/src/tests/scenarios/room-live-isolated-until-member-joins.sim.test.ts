import { openWorld } from '@pkgs/determinism';
import { acmeSystem } from '../apps/acme/system';
import { syncFacade } from '../../sim/system';
import { describe, test } from 'bun:test';
import { createSpace, expectLiveNote, isLiveNote, joinSpace, roomTopic, SPACE_MEMBERSHIP_SESSION, setSpaceNote } from '../apps/acme';

describe('room live isolated until member joins', () => {
  test('live on room-B does not reach alice in room-A until join', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 804,
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

    await a.mutate(createSpace, { id: 'room-a', title: 'A' });
    await b.mutate(createSpace, { id: 'room-b', title: 'B' });
    await world.until(() => a.subscribedTopics().includes(roomTopic('room-a')));
    await world.until(() => b.subscribedTopics().includes(roomTopic('room-b')));

    await b.mutate(setSpaceNote, {
      id: 'b-only',
      spaceId: 'room-b',
      body: 'secret-b',
    });
    await world.never(() => isLiveNote(a.db, 'b-only'), { forMs: 300 });
    await expectLiveNote(b.db, 'b-only', { body: 'secret-b' });

    await a.mutate(joinSpace, { spaceId: 'room-b' });
    await world.until(() => a.subscribedTopics().includes(roomTopic('room-b')));
    await world.assertConverged();
    await expectLiveNote(a.db, 'b-only', { body: 'secret-b' });
  });
});
