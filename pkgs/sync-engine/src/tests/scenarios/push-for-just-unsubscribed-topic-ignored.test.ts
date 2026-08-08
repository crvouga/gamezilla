import { describe, test } from 'bun:test';
import {
  createSpace,
  expectLiveNote,
  expectNoteNotLive,
  joinSpace,
  leaveSpace,
  notesDomainPack,
  roomTopic,
  SPACE_MEMBERSHIP_SESSION,
  setSpaceNote,
} from '../../domain-packs/notes-app';
import { RELIABLE_FAULTS } from '../../sim/faults';
import { openSimWorld } from '../../sim/world';

describe('push for just unsubscribed topic ignored', () => {
  test('leave races room push; ignored without error; engine stays healthy', async () => {
    await using world = await openSimWorld({
      domain: notesDomainPack,
      seed: 812,
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

    await a.mutate(createSpace, { id: 'race-room', title: 'R' });
    await b.mutate(joinSpace, { spaceId: 'race-room' });
    await world.assertConverged();
    await world.until(() =>
      a.subscribedTopics().includes(roomTopic('race-room'))
    );

    await a.mutate(leaveSpace, { spaceId: 'race-room' });
    await world.until(
      () => !a.subscribedTopics().includes(roomTopic('race-room'))
    );

    {
      using _hold = world.net('alice', 'sync').set('hold');
      await b.mutate(setSpaceNote, {
        id: 'late-push',
        spaceId: 'race-room',
        body: 'missed',
      });
      await world.runFor(300);
      await expectNoteNotLive(a.db, 'late-push');
      await expectLiveNote(b.db, 'late-push', { body: 'missed' });
    }
    await a.mutate(joinSpace, { spaceId: 'race-room' });
    await world.assertConverged();
    await expectLiveNote(a.db, 'late-push', { body: 'missed' });
  });
});
