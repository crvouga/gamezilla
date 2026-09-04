import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  expectConverged,
  mutate,
  setNote,
} from '../apps/acme';
import { expectLiveNoteAt, isNoteLiveAt } from '../apps/acme/reads';

describe('entry channel wakes never-held row', () => {
  test('entryChannel delivers peer create before local ever held the row', async () => {
    await using s = await acmeSystem.script({
      seed: 1220,
      args: { clientCount: 0 },
    });

    // notesAll entryChannel = NOTES_ALL_TOPIC (no prior row for n-fresh).
    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');

    expect(await isNoteLiveAt(s, 'bob', 'n-fresh')).toBe(false);

    await s.apply(mutate, 'alice', setNote, {
      id: 'n-fresh',
      body: 'via-entry',
    });
    await expectConverged(s);

    await expectLiveNoteAt(s, 'bob', 'n-fresh', { body: 'via-entry' });
  });
});
