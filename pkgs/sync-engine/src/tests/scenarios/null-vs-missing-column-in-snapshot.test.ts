import { describe, expect, test } from 'bun:test';
import { openSimWorld } from '../../sim/world';
import {
  acmeDomainPack,
  expectLiveNote,
  readLiveNotes,
  setNote,
} from '../apps/acme';

describe('null vs missing column in snapshot', () => {
  test('explicit null folderId and omitted folderId both yield null folder_id', async () => {
    await using world = await openSimWorld({
      domain: acmeDomainPack,
      seed: 1000,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.mutate(setNote, {
      id: 'explicit-null',
      body: 'n',
      folderId: null,
    });
    await a.mutate(setNote, {
      id: 'omitted',
      body: 'o',
      // folderId omitted — same wire outcome as null for this mutation.
    });
    await world.assertConverged();

    const notes = await readLiveNotes(b.db);
    const explicit = notes.find((n) => n.id === 'explicit-null');
    const omitted = notes.find((n) => n.id === 'omitted');
    expect(explicit?.folder_id).toBeNull();
    expect(omitted?.folder_id).toBeNull();
    await expectLiveNote(b.db, 'explicit-null', { body: 'n' });
    await expectLiveNote(b.db, 'omitted', { body: 'o' });
  });

  test.each([1001, 1002, 1003])(
    'seed sweep null vs omitted folderId converge identically (seed=%i)',
    async (seed) => {
      await using world = await openSimWorld({
        domain: acmeDomainPack,
        seed,
      });
      const a = await world.addClient({ id: 'alice' });
      await world.addClient({ id: 'bob' });
      await a.mutate(setNote, {
        id: `n-${seed}`,
        body: 'x',
        folderId: null,
      });
      await a.mutate(setNote, { id: `m-${seed}`, body: 'y' });
      await world.assertConverged();
      const notes = await readLiveNotes(world.server.db);
      expect(notes.every((n) => n.folder_id === null)).toBe(true);
    }
  );
});
