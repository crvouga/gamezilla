import { describe, test } from 'bun:test';
import {
  addClient,
  exampleSystem,
  expectInSync,
  expectLiveNoteAt,
  expectNotesAgree,
  mutate,
  nudge,
  setNote,
  subscribe,
  unsubscribe,
} from '@pkgs/sync-engine/sim';

describe('denied query detaches scope keeps rows', () => {
  test('denied query detaches scope without wiping domain', async () => {
    await using s = await exampleSystem.run({
      seed: 512,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'keep-me' });
    await expectInSync(s);
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
