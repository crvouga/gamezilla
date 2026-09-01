import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import {
  expectLiveNote,
  readLiveFolders,
  setFolder,
  setNote,
} from '../apps/acme';
import { acmeSystem } from '../apps/acme/system';

describe('row image for inactive table ignored safely', () => {
  test('server folders push ignored by notesOnly peer; later note push applies', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 807,
      knobs: {
        clientCount: 0,
      },
    });
    const world = host.facade;
    const a = await world.addClient({ id: 'alice' });
    const notesPeer = await world.addClient({
      id: 'notesPeer',
      sessionQuery: { name: 'notesOnly', params: {} },
    });

    await a.mutate(setNote, { id: 'n1', body: 'seed' });
    await world.runFor(400);
    await expectLiveNote(notesPeer.db, 'n1', { body: 'seed' });
    expect(await readLiveFolders(notesPeer.db)).toEqual([]);

    // No optimistic fanout — only server push (table-filtered).
    await a.disconnect();
    await a.mutate(setFolder, { id: 'f1', title: 'ignored' });
    {
      using _hold = world.net('notesPeer', 'sync').set('hold');
      await a.connect();
      await world.runFor(400);

      expect(await readLiveFolders(notesPeer.db)).toEqual([]);
      await expectLiveNote(notesPeer.db, 'n1', { body: 'seed' });

      await a.mutate(setNote, { id: 'n1', body: 'after-ignore' });
      await world.runFor(300);
      await expectLiveNote(notesPeer.db, 'n1', { body: 'after-ignore' });
    }
    await world.node('notesPeer').crash();
    await world.addClient({ id: 'bob' });
    await world.assertConverged();
  });
});
