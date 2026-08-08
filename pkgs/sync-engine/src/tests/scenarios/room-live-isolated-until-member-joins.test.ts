import { describe, test } from 'bun:test';
import {
  createSpace,
  expectLiveNote,
  expectNoteNotLive,
  joinSpace,
  notesDomainPack,
  roomTopic,
  SPACE_MEMBERSHIP_SESSION,
  setSpaceNote,
} from '../../domain-packs/notes-app';
import { RELIABLE_FAULTS } from '../../sim/faults';
import { openSimWorld } from '../../sim/world';

describe('room live isolated until member joins', () => {
  test('live on room-B does not reach alice in room-A until join', async () => {
    await using world = await openSimWorld({
      domain: notesDomainPack,
      seed: 804,
      faults: RELIABLE_FAULTS,
    });
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
    await world.runFor(300);
    await world.until(() => a.subscribedTopics().includes(roomTopic('room-a')));
    await world.until(() => b.subscribedTopics().includes(roomTopic('room-b')));

    await b.mutate(setSpaceNote, {
      id: 'b-only',
      spaceId: 'room-b',
      body: 'secret-b',
    });
    await world.runFor(300);
    await expectNoteNotLive(a.db, 'b-only');
    await expectLiveNote(b.db, 'b-only', { body: 'secret-b' });

    await a.mutate(joinSpace, { spaceId: 'room-b' });
    await world.until(() => a.subscribedTopics().includes(roomTopic('room-b')));
    await world.assertConverged();
    await expectLiveNote(a.db, 'b-only', { body: 'secret-b' });
  });
});
