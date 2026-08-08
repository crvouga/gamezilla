import { describe, expect, test } from 'bun:test';

import { RELIABLE_FAULTS } from '../../sim/faults';
import {
  expectLiveNote,
  readLiveFolders,
  setNoteUndeclaredFolderWrite,
} from '../../sim/notes-app';
import { openSimWorld, type SimWorld } from '../../sim/world';

async function pump(
  world: SimWorld,
  work: Promise<unknown>,
  maxVirtualMs = 2_000
): Promise<void> {
  let done = false;
  const tracked = Promise.resolve(work).finally(() => {
    done = true;
  });
  const steps = Math.ceil(maxVirtualMs / 25);
  for (let i = 0; i < steps && !done; i += 1) {
    await world.runFor(25);
  }
  await tracked;
}

describe('undeclared table write misses table filter heals on wakeall', () => {
  // README known limitation 8 declaredWrites — push table filter only; not enforced.
  test('foldersOnly peer misses undeclared folder write until wakeAll refetch', async () => {
    const world = await openSimWorld({
      seed: 1070,
      faults: RELIABLE_FAULTS,
      rowImageFanout: false,
    });
    try {
      const a = await world.addClient({ id: 'alice' });
      const notesPeer = await world.addClient({
        id: 'notesPeer',
        sessionQuery: { name: 'notesOnly', params: {} },
      });
      const foldersPeer = await world.addClient({
        id: 'foldersPeer',
        sessionQuery: { name: 'foldersOnly', params: {} },
      });

      world.hold('foldersPeer', 'sync');
      await a.mutate(setNoteUndeclaredFolderWrite, {
        noteId: 'n1',
        folderId: 'f-undeclared',
        folderTitle: 'Hidden',
        body: 'note-ok',
      });
      await world.runFor(400);

      // notes declared → notesOnly peer can wake; folders write undeclared.
      await expectLiveNote(notesPeer.db, 'n1', { body: 'note-ok' });
      expect(await readLiveFolders(foldersPeer.db)).toEqual([]);

      world.release('foldersPeer', 'sync');
      await foldersPeer.engine.disconnect();
      await foldersPeer.engine.connect();
      await pump(world, foldersPeer.engine.waitForFirstSync());
      const folders = await readLiveFolders(foldersPeer.db);
      expect(folders.some((f) => f.id === 'f-undeclared')).toBe(true);

      await world.crashClient('notesPeer');
      await world.crashClient('foldersPeer');
      await world.assertConverged();
    } finally {
      await world.dispose();
    }
  });

  test('seed sweep undeclared folder write eventually visible', async () => {
    for (const seed of [1071, 1072, 1073] as const) {
      const world = await openSimWorld({
        seed,
        faults: RELIABLE_FAULTS,
        rowImageFanout: false,
      });
      try {
        const a = await world.addClient({ id: 'alice' });
        const foldersPeer = await world.addClient({
          id: 'foldersPeer',
          sessionQuery: { name: 'foldersOnly', params: {} },
        });
        await a.mutate(setNoteUndeclaredFolderWrite, {
          noteId: `n-${seed}`,
          folderId: `f-${seed}`,
          folderTitle: 'T',
          body: 'x',
        });
        await pump(world, foldersPeer.engine.refreshQueries());
        expect(
          (await readLiveFolders(foldersPeer.db)).some(
            (f) => f.id === `f-${seed}`
          )
        ).toBe(true);
        await world.crashClient('foldersPeer');
        await world.assertConverged();
      } finally {
        await world.dispose();
      }
    }
  });
});
