import { describe, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeDraws,
  acmeSystem,
  addClient,
  expectConverged,
  mutate,
  nudge,
  setNote,
  subscribe,
  syncVirtualHost,
  unsubscribe,
} from '../apps/acme';
import { expectLiveNoteAt, expectNotesAgree } from '../apps/acme/reads';

describe('denied query detaches scope keeps rows', () => {
  test('denied query detaches scope without wiping domain', async () => {
    await using run = await start(acmeSystem, {
      seed: 512,
      host: syncVirtualHost(),
      draws: acmeDraws({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'keep-me' });
    await expectConverged(run);
    await expectLiveNoteAt(run, 'alice', 'n1', { body: 'keep-me' });

    await run.apply(subscribe, 'alice', 'notesDenied', {});
    await expectLiveNoteAt(run, 'alice', 'n1', { body: 'keep-me' });
    await expectNotesAgree(run, 'alice');
    await run.apply(unsubscribe, 'alice', 'notesDenied');

    // Refresh after denied-scope unsubscribe must keep the row.
    await run.apply(nudge, 'alice');
    await expectLiveNoteAt(run, 'alice', 'n1', { body: 'keep-me' });
  });
});
