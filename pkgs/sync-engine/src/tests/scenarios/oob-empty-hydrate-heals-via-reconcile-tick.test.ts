import { describe, expect, test } from 'bun:test';
import {
  expectLiveNote,
  insertCatalogNote,
  isLiveNote,
  notesDomainPack,
  readLiveNotes,
  setNote,
  writeNoteBody,
} from '../../domain-packs/notes-app';
import { openSimWorld } from '../../sim/world';

describe('oob empty hydrate heals via reconcile tick', () => {
  // Chess-puzzle shaped: empty first sync, then silent catalog INSERT.
  // Missed notifyChannels must still heal via the reconcile tick (no nudge).

  test('silent catalog insert after empty hydrate heals without nudge', async () => {
    await using world = await openSimWorld({
      domain: notesDomainPack,
      seed: 1501,
    });
    const client = await world.addClient({ id: 'alice' });

    expect(await isLiveNote(client.db, 'n-seed')).toBe(false);

    await insertCatalogNote(world.server, {
      id: 'n-seed',
      body: 'seeded',
      notify: false,
    });
    await expectLiveNote(world.server.db, 'n-seed', { body: 'seeded' });

    await world.until(async () => isLiveNote(client.db, 'n-seed'));
    await expectLiveNote(client.db, 'n-seed', { body: 'seeded' });
    await world.assertConverged();
  });

  test('silent catalog update heals without nudge', async () => {
    await using world = await openSimWorld({
      domain: notesDomainPack,
      seed: 1502,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.mutate(setNote, { id: 'n1', body: 'v1' });
    await world.assertConverged();

    await writeNoteBody(world.server, {
      id: 'n1',
      body: 'v2-silent',
      notify: false,
    });
    await expectLiveNote(world.server.db, 'n1', { body: 'v2-silent' });

    await world.until(async () =>
      (await readLiveNotes(b.db)).some(
        (n) => n.id === 'n1' && n.body === 'v2-silent'
      )
    );
    await expectLiveNote(b.db, 'n1', { body: 'v2-silent' });
    await world.assertConverged();
  });
});
