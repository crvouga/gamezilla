import { describe, expect, test } from 'bun:test';
import { script } from '@pkgs/dst';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  expectConverged,
  expectLiveNoteAt,
  liveNotes,
  mutate,
  setNote,
  syncVirtualHost,
} from '../apps/acme';

describe('null vs missing column in snapshot', () => {
  test('explicit null folderId and omitted folderId both yield null folder_id', async () => {
    await using run = await script(acmeSystem, {
      seed: 1000,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });

    await run.apply(mutate, 'alice', setNote, {
      id: 'explicit-null',
      body: 'n',
      folderId: null,
    });
    await run.apply(mutate, 'alice', setNote, {
      id: 'omitted',
      body: 'o',
      // folderId omitted — same wire outcome as null for this mutation.
    });
    await expectConverged(run);

    const notes = await run.observe(liveNotes, 'bob');
    expect(notes.find((n) => n.id === 'explicit-null')?.folderId).toBeNull();
    expect(notes.find((n) => n.id === 'omitted')?.folderId).toBeNull();
    await expectLiveNoteAt(run, 'bob', 'explicit-null', { body: 'n' });
    await expectLiveNoteAt(run, 'bob', 'omitted', { body: 'o' });
  });

  test.each([1001, 1002, 1003])(
    'seed sweep null vs omitted folderId converge identically (seed=%i)',
    async (seed) => {
      await using run = await script(acmeSystem, {
        seed: seed,
        host: syncVirtualHost(),
        knobs: acmeKnobs({ clientCount: 0 }),
        properties: [],
      });

      await run.apply(addClient, { id: 'alice' });
      await run.apply(addClient, { id: 'bob' });
      await run.apply(mutate, 'alice', setNote, {
        id: `n-${seed}`,
        body: 'x',
        folderId: null,
      });
      await run.apply(mutate, 'alice', setNote, { id: `m-${seed}`, body: 'y' });
      await expectConverged(run);
      const notes = await run.observe(liveNotes, 'server');
      expect(notes.every((n) => n.folderId === null)).toBe(true);
    }
  );
});
