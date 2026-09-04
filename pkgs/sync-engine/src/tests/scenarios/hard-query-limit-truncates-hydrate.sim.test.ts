import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  crash,
  deleteNote,
  expectConverged,
  liveFolders,
  liveNote,
  liveNotes,
  mutate,
  nudge,
  setFolder,
  setNote,
} from '../apps/acme';

const LIMITED_SESSION = { name: 'notesLimited', params: {} };

describe('hard query limit truncates hydrate', () => {
  test('hard limit truncates hydrate; engine stays healthy and the run converges', async () => {
    await using s = await acmeSystem.script({
      seed: 630,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });

    for (let i = 0; i < 12; i += 1) {
      await s.apply(mutate, 'alice', setNote, {
        id: `n${String(i).padStart(2, '0')}`,
        body: `b${i}`,
      });
    }
    await expectConverged(s);
    expect((await s.observe(liveNotes, 'server')).length).toBe(12);

    await s.apply(addClient, {
      id: 'limited',
      sessionQuery: LIMITED_SESSION,
    });
    expect((await s.observe(liveNotes, 'limited')).length).toBe(5);

    await s.apply(mutate, 'alice', setNote, {
      id: 'n99',
      body: 'after-limit',
    });
    // Limited peer cannot full-converge (missing rows by design).
    await s.apply(crash, 'limited');
    await expectConverged(s);
    expect(await s.observe(liveNote, 'alice', 'n99')).toMatchObject({
      body: 'after-limit',
    });
  });

  test('multi-table truncate then shrink below limit eventually consistent', async () => {
    await using s = await acmeSystem.script({
      seed: 631,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });

    await s.apply(mutate, 'alice', setFolder, { id: 'f1', title: 'Work' });
    await s.apply(mutate, 'alice', setFolder, { id: 'f2', title: 'Home' });
    for (let i = 0; i < 8; i += 1) {
      await s.apply(mutate, 'alice', setNote, {
        id: `n${String(i).padStart(2, '0')}`,
        body: `b${i}`,
        folderId: i % 2 === 0 ? 'f1' : 'f2',
      });
    }
    await expectConverged(s);

    await s.apply(addClient, {
      id: 'limited',
      sessionQuery: LIMITED_SESSION,
    });
    expect((await s.observe(liveNotes, 'limited')).length).toBe(5);
    // Limited session hydrates notes only — folders stay empty (knowingly partial).
    expect(await s.observe(liveFolders, 'limited')).toEqual([]);

    // Shrink live set below hard limit so a later refetch can be complete.
    for (const id of ['n05', 'n06', 'n07'] as const) {
      await s.apply(mutate, 'alice', deleteNote, { id });
    }
    await s.apply(crash, 'limited');
    await s.apply(addClient, {
      id: 'limited',
      sessionQuery: LIMITED_SESSION,
    });
    // nudge: limited session refetch after shrink below hard limit
    await s.apply(nudge, 'limited');
    const after = await s.observe(liveNotes, 'limited');
    expect(after.length).toBe(5);
    expect(after.map((n) => n.id).sort()).toEqual([
      'n00',
      'n01',
      'n02',
      'n03',
      'n04',
    ]);

    await s.apply(crash, 'limited');
    await expectConverged(s);
    expect(await s.observe(liveNote, 'alice', 'n00')).toMatchObject({
      body: 'b0',
    });
    expect((await s.observe(liveFolders, 'alice')).length).toBe(2);
  });
});
