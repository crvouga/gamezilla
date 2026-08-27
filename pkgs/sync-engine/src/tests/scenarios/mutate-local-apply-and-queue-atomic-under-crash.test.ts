import { describe, expect, test } from 'bun:test';
import {
  expectLiveNote,
  expectNoteNotLive,
  expectNotesMatchServer,
  acmeDomainPack,
  readLiveNotes,
  setNote,
} from '../apps/acme';
import { openSimWorld } from '../../sim/world';

describe('mutate local apply and queue atomic under crash', () => {
  test('crash after mutate resolves offline: write everywhere or nowhere', async () => {
    await using world = await openSimWorld({
      domain: acmeDomainPack,
      seed: 831,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.mutate(setNote, { id: 'warm', body: 'w' });
    await world.assertConverged();

    a.online(false);
    using _arm = world.node('alice').crash({
      at: 'afterNextMutateResolved',
    });
    const result = await a.mutate(setNote, {
      id: 'atomic',
      body: 'queued-or-absent',
    });
    // Crash fires after mutate resolves — alice handle is disposed.
    expect(world.clients.has('alice')).toBe(false);
    expect(result.ok).toBe(true);

    const alice = await world.node('alice').restart({
      preserveLocalDb: true,
    });
    await world.assertConverged();

    const onServer = (await readLiveNotes(world.server.db)).some(
      (r) => r.id === 'atomic' && r.body === 'queued-or-absent'
    );
    if (onServer) {
      await expectLiveNote(alice!.db, 'atomic', { body: 'queued-or-absent' });
      await expectLiveNote(b.db, 'atomic', { body: 'queued-or-absent' });
    } else {
      await expectNoteNotLive(alice!.db, 'atomic');
      await expectNoteNotLive(b.db, 'atomic');
    }
    await expectNotesMatchServer(alice!.db, world.server.db);
    await expectNotesMatchServer(b.db, world.server.db);
  });
});
