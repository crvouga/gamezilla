import { describe, expect, test } from 'bun:test';
import {
  deleteNote,
  expectLiveNote,
  notesDomainPack,
  readLiveFolders,
  readLiveNotes,
  setFolder,
  setNote,
} from '../../domain-packs/notes-app';
import { RELIABLE_FAULTS } from '../../sim/faults';
import { openSimWorld } from '../../sim/world';

describe('hard query limit truncates hydrate', () => {
  test('hard limit truncates hydrate; engine stays healthy and world converges', async () => {
    await using world = await openSimWorld({
      domain: notesDomainPack,
      seed: 630,
      faults: RELIABLE_FAULTS,
    });
    const a = await world.addClient({ id: 'alice' });
    await world.addClient({ id: 'bob' });

    for (let i = 0; i < 12; i += 1) {
      await a.mutate(setNote, {
        id: `n${String(i).padStart(2, '0')}`,
        body: `b${i}`,
      });
    }
    await world.assertConverged();
    expect((await readLiveNotes(world.server.db)).length).toBe(12);

    const lim = await world.addClient({
      id: 'limited',
      sessionQuery: { name: 'notesLimited', params: {} },
    });
    const hydrated = await readLiveNotes(lim.db);
    expect(hydrated.length).toBeLessThanOrEqual(5);
    expect(hydrated.length).toBe(5);

    await a.mutate(setNote, { id: 'n99', body: 'after-limit' });
    // Limited peer cannot full-converge (missing rows by design).
    await world.node('limited').crash();
    await world.assertConverged();
    await expectLiveNote(a.db, 'n99', { body: 'after-limit' });
  });

  test('multi-table truncate then shrink below limit eventually consistent', async () => {
    await using world = await openSimWorld({
      domain: notesDomainPack,
      seed: 631,
      faults: RELIABLE_FAULTS,
    });
    const a = await world.addClient({ id: 'alice' });
    await world.addClient({ id: 'bob' });

    await a.mutate(setFolder, { id: 'f1', title: 'Work' });
    await a.mutate(setFolder, { id: 'f2', title: 'Home' });
    for (let i = 0; i < 8; i += 1) {
      await a.mutate(setNote, {
        id: `n${String(i).padStart(2, '0')}`,
        body: `b${i}`,
        folderId: i % 2 === 0 ? 'f1' : 'f2',
      });
    }
    await world.assertConverged();

    const lim = await world.addClient({
      id: 'limited',
      sessionQuery: { name: 'notesLimited', params: {} },
    });
    expect((await readLiveNotes(lim.db)).length).toBe(5);
    // Limited session hydrates notes only — folders stay empty (knowingly partial).
    expect(await readLiveFolders(lim.db)).toEqual([]);

    // Shrink live set below hard limit so a later refetch can be complete.
    for (const id of ['n05', 'n06', 'n07'] as const) {
      await a.mutate(deleteNote, { id });
    }
    await world.node('limited').crash();
    const lim2 = await world.addClient({
      id: 'limited',
      sessionQuery: { name: 'notesLimited', params: {} },
    });
    // nudge: limited session refetch after shrink below hard limit
    await world.until(lim2.nudge());
    const after = await readLiveNotes(lim2.db);
    expect(after.length).toBe(5);
    expect(after.map((n) => n.id).sort()).toEqual([
      'n00',
      'n01',
      'n02',
      'n03',
      'n04',
    ]);

    await world.node('limited').crash();
    await world.assertConverged();
    await expectLiveNote(a.db, 'n00', { body: 'b0' });
    expect((await readLiveFolders(a.db)).length).toBe(2);
  });
});
