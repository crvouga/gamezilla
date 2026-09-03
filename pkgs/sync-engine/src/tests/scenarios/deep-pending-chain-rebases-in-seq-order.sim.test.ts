import { describe, expect, test } from 'bun:test';
import { script } from '@pkgs/dst';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  connect,
  disconnect,
  expectConverged,
  expectLiveNoteAt,
  expectNotesAgree,
  liveFolders,
  liveNotes,
  mutate,
  passTime,
  setFolder,
  setNote,
  syncVirtualHost,
} from '../apps/acme';

const CHAIN = 60;

const pad = (i: number): string => String(i).padStart(3, '0');

describe('deep pending chain rebases in seq order', () => {
  test('50+ pending folders+notes rebase in seq order to server truth', async () => {
    await using run = await script(acmeSystem, {
      seed: 822,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });

    await run.apply(disconnect, 'alice');
    for (let i = 0; i < CHAIN; i += 1) {
      if (i % 2 === 0) {
        await run.apply(mutate, 'alice', setFolder, {
          id: `f-${pad(i)}`,
          title: `F${i}`,
        });
      } else {
        await run.apply(mutate, 'alice', setNote, {
          id: `n-${pad(i)}`,
          body: `B${i}`,
          folderId: `f-${pad(i - 1)}`,
        });
      }
    }
    await run.apply(passTime, 50);

    await run.apply(connect, 'alice');
    await expectConverged(run);

    expect((await run.observe(liveNotes('server'))).length).toBe(CHAIN / 2);
    expect((await run.observe(liveFolders('server'))).length).toBe(CHAIN / 2);
    await expectLiveNoteAt(run, 'bob', 'n-001', { body: 'B1' });
    await expectLiveNoteAt(run, 'bob', `n-${pad(CHAIN - 1)}`, {
      body: `B${CHAIN - 1}`,
    });
    await expectNotesAgree(run, 'alice');
    await expectNotesAgree(run, 'bob');
  });
});
