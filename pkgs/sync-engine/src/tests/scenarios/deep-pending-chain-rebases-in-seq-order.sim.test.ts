import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { syncFacade } from '../../sim/system';
import {
  expectLiveNote,
  expectNotesMatchServer,
  readLiveFolders,
  readLiveNotes,
  setFolder,
  setNote,
} from '../apps/acme';
import { acmeSystem } from '../apps/acme/system';

const CHAIN = 60;

describe('deep pending chain rebases in seq order', () => {
  test('50+ pending folders+notes rebase in seq order to server truth', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 822,
      knobs: {
        clientCount: 0,
      },
    });
    const world = syncFacade(host.system);
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.disconnect();
    for (let i = 0; i < CHAIN; i += 1) {
      const n = String(i).padStart(3, '0');
      if (i % 2 === 0) {
        await a.mutate(setFolder, { id: `f-${n}`, title: `F${i}` });
      } else {
        await a.mutate(setNote, {
          id: `n-${n}`,
          body: `B${i}`,
          folderId: `f-${String(i - 1).padStart(3, '0')}`,
        });
      }
    }
    await world.runFor(50);

    await a.connect();
    await world.assertConverged();

    const serverNotes = await readLiveNotes(world.server.db);
    const serverFolders = await readLiveFolders(world.server.db);
    expect(serverNotes.length).toBe(CHAIN / 2);
    expect(serverFolders.length).toBe(CHAIN / 2);
    await expectLiveNote(b.db, 'n-001', { body: 'B1' });
    await expectLiveNote(b.db, `n-${String(CHAIN - 1).padStart(3, '0')}`, {
      body: `B${CHAIN - 1}`,
    });
    await expectNotesMatchServer(a.db, world.server.db);
    await expectNotesMatchServer(b.db, world.server.db);
  });
});
