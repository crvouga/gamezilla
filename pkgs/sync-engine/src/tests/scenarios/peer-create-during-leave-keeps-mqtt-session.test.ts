import { describe, expect, test } from 'bun:test';
import {
  createSpace,
  expectLiveNote,
  joinSpace,
  leaveSpace,
  notesDomainPack,
  roomTopic,
  SPACE_MEMBERSHIP_SESSION,
  setSpaceNote,
} from '../../domain-packs/notes-app';
import { openSimWorld } from '../../sim/world';

describe('peer create during leave keeps mqtt session', () => {
  test('peer create during leave does not remake MQTT; rejoin hydrates', async () => {
    await using world = await openSimWorld({
      domain: notesDomainPack,
      seed: 802,
    });
    const a = await world.addClient({
      id: 'alice',
      sessionQuery: SPACE_MEMBERSHIP_SESSION,
    });
    const b = await world.addClient({
      id: 'bob',
      sessionQuery: SPACE_MEMBERSHIP_SESSION,
    });

    await a.mutate(createSpace, { id: 'room-1', title: 'R' });
    await b.mutate(joinSpace, { spaceId: 'room-1' });
    await world.assertConverged();
    await world.until(() => a.subscribedTopics().includes(roomTopic('room-1')));
    const remakes = a.pubsubRemakeCount();

    await a.mutate(leaveSpace, { spaceId: 'room-1' });
    await b.mutate(setSpaceNote, {
      id: 'n-during-leave',
      spaceId: 'room-1',
      body: 'created-while-leave',
    });
    await world.runFor(300);

    expect(a.pubsubRemakeCount()).toBe(remakes);
    await expectLiveNote(b.db, 'n-during-leave', {
      body: 'created-while-leave',
    });
    await expectLiveNote(world.server.db, 'n-during-leave', {
      body: 'created-while-leave',
    });

    await a.mutate(joinSpace, { spaceId: 'room-1' });
    await world.assertConverged();
    await expectLiveNote(a.db, 'n-during-leave', {
      body: 'created-while-leave',
    });
    expect(a.pubsubRemakeCount()).toBe(remakes);
  });
});
