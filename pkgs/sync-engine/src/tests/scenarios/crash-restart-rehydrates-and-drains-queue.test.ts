import { describe, test } from 'bun:test';
import {
  expectLiveNote,
  notesDomainPack,
  setNote,
} from '../../domain-packs/notes-app';
import { RELIABLE_FAULTS } from '../../sim/faults';
import { openSimWorld } from '../../sim/world';

describe('crash restart rehydrates and drains queue', () => {
  test('offline queue drains after reconnect', async () => {
    await using world = await openSimWorld({
      domain: notesDomainPack,
      seed: 40,
      faults: RELIABLE_FAULTS,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    a.online(false);
    await a.mutate(setNote, { id: 'n1', body: 'queued' });
    await world.runFor(50);

    a.online(true);
    await world.assertConverged();
    await expectLiveNote(b.db, 'n1', { body: 'queued' });
  });

  test('restart after crash rehydrates all live notes', async () => {
    await using world = await openSimWorld({
      domain: notesDomainPack,
      seed: 41,
      faults: RELIABLE_FAULTS,
    });
    const a = await world.addClient({ id: 'alice' });
    await world.addClient({ id: 'bob' });
    await a.mutate(setNote, { id: 'n1', body: 'one' });
    await a.mutate(setNote, { id: 'n2', body: 'two' });
    await world.assertConverged();

    await world.node('bob').crash();
    const bob = await world.node('bob').restart();
    await world.assertConverged();
    await expectLiveNote(bob!.db, 'n1', { body: 'one' });
    await expectLiveNote(bob!.db, 'n2', { body: 'two' });
  });
});
