import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  expectConverged,
  expectLiveNoteAt,
  isNoteLiveAt,
  liveNote,
  noteBodyIs,
  serverOp,
  untilAcme,
} from '../apps/acme';

describe('non mutation catalog insert wakes empty hydrate', () => {
  // Chess-puzzle shaped bug: empty first sync of an all-rows entryChannel query,
  // then a non-mutation catalog INSERT. notify on the entry topic must wake
  // the client fast; without notify the reconcile tick still heals.

  test('insertCatalogNote notify true wakes client after empty hydrate', async () => {
    await using s = await acmeSystem.script({
      seed: 1401,
      args: {
        clientCount: 0,
      },
    });

    await s.apply(addClient, { id: 'alice' });

    expect(await isNoteLiveAt(s, 'alice', 'n-seed')).toBe(false);

    await s.apply(serverOp, 'insertCatalogNoteNotify', {
      noteId: 'n-seed',
      body: 'seeded',
    });
    await expectLiveNoteAt(s, 'server', 'n-seed', { body: 'seeded' });

    await untilAcme(s, (s) => liveNote(s, 'alice', 'n-seed'), {
      pred: noteBodyIs('seeded'),
    });
    await expectConverged(s);
  });

  test('insertCatalogNote notify false heals via reconcile tick', async () => {
    await using s = await acmeSystem.script({
      seed: 1402,
      args: {
        clientCount: 0,
      },
    });

    await s.apply(addClient, { id: 'alice' });

    expect(await isNoteLiveAt(s, 'alice', 'n-silent')).toBe(false);

    await s.apply(serverOp, 'insertCatalogNoteSilent', {
      noteId: 'n-silent',
      body: 'seeded-silent',
    });
    await expectLiveNoteAt(s, 'server', 'n-silent', {
      body: 'seeded-silent',
    });

    // No notify → no instant wake; reconcile tick heals below.
    expect(await isNoteLiveAt(s, 'alice', 'n-silent')).toBe(false);

    await untilAcme(s, (s) => liveNote(s, 'alice', 'n-silent'), {
      pred: noteBodyIs('seeded-silent'),
    });
    await expectConverged(s);
  });
});
