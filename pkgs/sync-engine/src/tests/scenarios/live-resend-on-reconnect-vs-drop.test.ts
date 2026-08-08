import { describe, test } from 'bun:test';
import {
  expectLiveNote,
  expectNoteNotLive,
  notesDomainPack,
  setNote,
} from '../../domain-packs/notes-app';
import { RELIABLE_FAULTS } from '../../sim/faults';
import { openSimWorld } from '../../sim/world';

describe('live resend on reconnect vs drop', () => {
  test('default: missed live is dropped; sync pull repairs', async () => {
    await using world = await openSimWorld({
      domain: notesDomainPack,
      seed: 601,
      faults: RELIABLE_FAULTS,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await a.mutate(setNote, { id: 'warm', body: 'w' });
    await world.assertConverged();

    await b.disconnect();
    using _hold = world.net('bob', 'sync').set('hold');
    await a.mutate(setNote, { id: 'n1', body: 'while-down' });
    await world.runFor(80);

    await b.connect();
    await world.runFor(200);
    await expectNoteNotLive(b.db, 'n1');

    _hold.restore();
    await world.assertConverged();
    await expectLiveNote(b.db, 'n1', { body: 'while-down' });
  });

  test('liveResendOnReconnect: consistent from resent live while sync held', async () => {
    await using world = await openSimWorld({
      domain: notesDomainPack,
      seed: 602,
      faults: RELIABLE_FAULTS,
      liveResendOnReconnect: true,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await a.mutate(setNote, { id: 'warm', body: 'w' });
    await world.assertConverged();

    await b.disconnect();
    using _hold = world.net('bob', 'sync').set('hold');
    await a.mutate(setNote, { id: 'n1', body: 'resent' });
    await world.runFor(80);

    await b.connect();
    await world.runFor(200);
    await expectLiveNote(b.db, 'n1', { body: 'resent' });

    _hold.restore();
    await world.assertConverged();
    await expectLiveNote(b.db, 'n1', { body: 'resent' });
  });
});
