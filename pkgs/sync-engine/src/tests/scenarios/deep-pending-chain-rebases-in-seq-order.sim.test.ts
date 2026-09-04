import { describe, expect, test } from 'bun:test';
import {
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
  setFolder,
  setNote,
} from '../apps/acme';

const CHAIN = 60;

const pad = (i: number): string => String(i).padStart(3, '0');

describe('deep pending chain rebases in seq order', () => {
  test('50+ pending folders+notes rebase in seq order to server truth', async () => {
    await using s = await acmeSystem.script({
      seed: 822,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });

    await s.apply(disconnect, 'alice');
    for (let i = 0; i < CHAIN; i += 1) {
      if (i % 2 === 0) {
        await s.apply(mutate, 'alice', setFolder, {
          id: `f-${pad(i)}`,
          title: `F${i}`,
        });
      } else {
        await s.apply(mutate, 'alice', setNote, {
          id: `n-${pad(i)}`,
          body: `B${i}`,
          folderId: `f-${pad(i - 1)}`,
        });
      }
    }
    await s.elapse(50);

    await s.apply(connect, 'alice');
    await expectConverged(s);

    expect((await s.observe(liveNotes, 'server')).length).toBe(CHAIN / 2);
    expect((await s.observe(liveFolders, 'server')).length).toBe(CHAIN / 2);
    await expectLiveNoteAt(s, 'bob', 'n-001', { body: 'B1' });
    await expectLiveNoteAt(s, 'bob', `n-${pad(CHAIN - 1)}`, {
      body: `B${CHAIN - 1}`,
    });
    await expectNotesAgree(s, 'alice');
    await expectNotesAgree(s, 'bob');
  });
});
