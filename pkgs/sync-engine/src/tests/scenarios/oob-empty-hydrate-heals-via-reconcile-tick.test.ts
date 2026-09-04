import { describe, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  expectConverged,
  expectLiveNoteAt,
  expectNoteNotLiveAt,
  liveNote,
  mutate,
  noteBodyIs,
  serverOp,
  setNote,
  untilAcme,
} from '../apps/acme';

describe('oob empty hydrate heals via reconcile tick', () => {
  // Chess-puzzle shaped: empty first sync, then silent catalog INSERT.
  // Missed notifyChannels must still heal via the reconcile tick (no nudge).

  test('silent catalog insert after empty hydrate heals without nudge', async () => {
    await using s = await acmeSystem.script({
      seed: 1501,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await expectNoteNotLiveAt(s, 'alice', 'n-seed');

    await s.apply(serverOp, 'insertCatalogNoteSilent', {
      noteId: 'n-seed',
      body: 'seeded',
    });
    await expectLiveNoteAt(s, 'server', 'n-seed', { body: 'seeded' });

    await untilAcme(s, (s) => liveNote(s, 'alice', 'n-seed'), {
      pred: noteBodyIs('seeded'),
    });
    await expectLiveNoteAt(s, 'alice', 'n-seed', { body: 'seeded' });
    await expectConverged(s);
  });

  test('silent catalog update heals without nudge', async () => {
    await using s = await acmeSystem.script({
      seed: 1502,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });

    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'v1' });
    await expectConverged(s);

    await s.apply(serverOp, 'writeNoteBodySilent', {
      noteId: 'n1',
      body: 'v2-silent',
    });
    await expectLiveNoteAt(s, 'server', 'n1', { body: 'v2-silent' });

    await untilAcme(s, (s) => liveNote(s, 'bob', 'n1'), {
      pred: noteBodyIs('v2-silent'),
    });
    await expectLiveNoteAt(s, 'bob', 'n1', { body: 'v2-silent' });
    await expectConverged(s);
  });
});
