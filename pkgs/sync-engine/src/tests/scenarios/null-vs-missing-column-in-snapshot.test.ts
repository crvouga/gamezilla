import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  expectConverged,
  expectLiveNoteAt,
  liveNotes,
  mutate,
  setNote,
} from '../apps/acme';

describe('null vs missing column in snapshot', () => {
  test('explicit null folderId and omitted folderId both yield null folder_id', async () => {
    await using s = await acmeSystem.script({
      seed: 1000,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });

    await s.apply(mutate, 'alice', setNote, {
      id: 'explicit-null',
      body: 'n',
      folderId: null,
    });
    await s.apply(mutate, 'alice', setNote, {
      id: 'omitted',
      body: 'o',
      // folderId omitted — same wire outcome as null for this mutation.
    });
    await expectConverged(s);

    const notes = await s.observe(liveNotes, 'bob');
    expect(notes.find((n) => n.id === 'explicit-null')?.folderId).toBeNull();
    expect(notes.find((n) => n.id === 'omitted')?.folderId).toBeNull();
    await expectLiveNoteAt(s, 'bob', 'explicit-null', { body: 'n' });
    await expectLiveNoteAt(s, 'bob', 'omitted', { body: 'o' });
  });

  test.each([1001, 1002, 1003])(
    'seed sweep null vs omitted folderId converge identically (seed=%i)',
    async (seed) => {
      await using s = await acmeSystem.script({
        seed: seed,
        args: { clientCount: 0 },
      });

      await s.apply(addClient, { id: 'alice' });
      await s.apply(addClient, { id: 'bob' });
      await s.apply(mutate, 'alice', setNote, {
        id: `n-${seed}`,
        body: 'x',
        folderId: null,
      });
      await s.apply(mutate, 'alice', setNote, { id: `m-${seed}`, body: 'y' });
      await expectConverged(s);
      const notes = await s.observe(liveNotes, 'server');
      expect(notes.every((n) => n.folderId === null)).toBe(true);
    }
  );
});
