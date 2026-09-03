import { describe, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeDraws,
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
  syncVirtualHost,
  untilAcme,
} from '../apps/acme';

describe('oob empty hydrate heals via reconcile tick', () => {
  // Chess-puzzle shaped: empty first sync, then silent catalog INSERT.
  // Missed notifyChannels must still heal via the reconcile tick (no nudge).

  test('silent catalog insert after empty hydrate heals without nudge', async () => {
    await using run = await start(acmeSystem, {
      seed: 1501,
      host: syncVirtualHost(),
      draws: acmeDraws({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await expectNoteNotLiveAt(run, 'alice', 'n-seed');

    await run.apply(serverOp, 'insertCatalogNoteSilent', {
      noteId: 'n-seed',
      body: 'seeded',
    });
    await expectLiveNoteAt(run, 'server', 'n-seed', { body: 'seeded' });

    await untilAcme(run, liveNote('alice', 'n-seed'), {
      pred: noteBodyIs('seeded'),
    });
    await expectLiveNoteAt(run, 'alice', 'n-seed', { body: 'seeded' });
    await expectConverged(run);
  });

  test('silent catalog update heals without nudge', async () => {
    await using run = await start(acmeSystem, {
      seed: 1502,
      host: syncVirtualHost(),
      draws: acmeDraws({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });

    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'v1' });
    await expectConverged(run);

    await run.apply(serverOp, 'writeNoteBodySilent', {
      noteId: 'n1',
      body: 'v2-silent',
    });
    await expectLiveNoteAt(run, 'server', 'n1', { body: 'v2-silent' });

    await untilAcme(run, liveNote('bob', 'n1'), {
      pred: noteBodyIs('v2-silent'),
    });
    await expectLiveNoteAt(run, 'bob', 'n1', { body: 'v2-silent' });
    await expectConverged(run);
  });
});
