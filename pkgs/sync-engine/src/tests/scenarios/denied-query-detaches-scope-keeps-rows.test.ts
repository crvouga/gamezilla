import { describe, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  expectConverged,
  mutate,
  nudge,
  setNote,
  subscribe,
  unsubscribe,
} from '../apps/acme';
import { expectLiveNoteAt, expectNotesAgree } from '../apps/acme/reads';

describe('denied query detaches scope keeps rows', () => {
  test('denied query detaches scope without wiping domain', async () => {
    await using s = await acmeSystem.script({
      seed: 512,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'keep-me' });
    await expectConverged(s);
    await expectLiveNoteAt(s, 'alice', 'n1', { body: 'keep-me' });

    await s.apply(subscribe, 'alice', 'notesDenied', {});
    await expectLiveNoteAt(s, 'alice', 'n1', { body: 'keep-me' });
    await expectNotesAgree(s, 'alice');
    await s.apply(unsubscribe, 'alice', 'notesDenied');

    // Refresh after denied-scope unsubscribe must keep the row.
    await s.apply(nudge, 'alice');
    await expectLiveNoteAt(s, 'alice', 'n1', { body: 'keep-me' });
  });
});
