import { describe, expect, test } from 'bun:test';
import { script } from '@pkgs/dst';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  expectConverged,
  hold,
  mutate,
  passTime,
  release,
  setNote,
  syncVirtualHost,
} from '../apps/acme';
import { expectLiveNoteAt, liveNotes } from '../apps/acme/reads';

describe('own echo floor skips but peer push applies', () => {
  test('mutator never flickers on own echo; peer still paints', async () => {
    await using run = await script(acmeSystem, {
      seed: 805,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');

    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'seed' });
    await expectConverged(run);

    await run.apply(hold, 'bob', 'sync');
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'final' });

    for (let i = 0; i < 8; i += 1) {
      await run.apply(passTime, 25);
      const notes = await run.observe(liveNotes('alice'));
      expect(notes.find((r) => r.id === 'n1')?.body).toBe('final');
    }

    await expectLiveNoteAt(run, 'bob', 'n1', { body: 'final' });

    await run.apply(release, 'bob', 'sync');
    await expectConverged(run);
    await expectLiveNoteAt(run, 'bob', 'n1', { body: 'final' });
  });
});
