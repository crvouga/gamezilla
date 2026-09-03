import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  expectConverged,
  expectLiveNoteAt,
  isNoteLiveAt,
  liveNote,
  noteBodyIs,
  serverOp,
  syncVirtualHost,
  untilAcme,
} from '../apps/acme';

describe('non mutation catalog insert wakes empty hydrate', () => {
  // Chess-puzzle shaped bug: empty first sync of an all-rows entryChannel query,
  // then a non-mutation catalog INSERT. notify on the entry topic must wake
  // the client fast; without notify the reconcile tick still heals.

  test('insertCatalogNote notify true wakes client after empty hydrate', async () => {
    await using run = await start(acmeSystem, {
      seed: 1401,
      host: syncVirtualHost(),
      knobs: acmeKnobs({
        clientCount: 0,
      }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });

    expect(await isNoteLiveAt(run, 'alice', 'n-seed')).toBe(false);

    await run.apply(serverOp, 'insertCatalogNoteNotify', {
      noteId: 'n-seed',
      body: 'seeded',
    });
    await expectLiveNoteAt(run, 'server', 'n-seed', { body: 'seeded' });

    await untilAcme(run, liveNote('alice', 'n-seed'), {
      pred: noteBodyIs('seeded'),
    });
    await expectConverged(run);
  });

  test('insertCatalogNote notify false heals via reconcile tick', async () => {
    await using run = await start(acmeSystem, {
      seed: 1402,
      host: syncVirtualHost(),
      knobs: acmeKnobs({
        clientCount: 0,
      }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });

    expect(await isNoteLiveAt(run, 'alice', 'n-silent')).toBe(false);

    await run.apply(serverOp, 'insertCatalogNoteSilent', {
      noteId: 'n-silent',
      body: 'seeded-silent',
    });
    await expectLiveNoteAt(run, 'server', 'n-silent', {
      body: 'seeded-silent',
    });

    // No notify → no instant wake; reconcile tick heals below.
    expect(await isNoteLiveAt(run, 'alice', 'n-silent')).toBe(false);

    await untilAcme(run, liveNote('alice', 'n-silent'), {
      pred: noteBodyIs('seeded-silent'),
    });
    await expectConverged(run);
  });
});
