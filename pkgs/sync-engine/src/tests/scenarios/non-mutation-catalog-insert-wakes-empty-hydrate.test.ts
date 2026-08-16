import { describe, expect, test } from 'bun:test';
import {
  expectLiveNote,
  insertCatalogNote,
  isLiveNote,
  notesDomainPack,
  readLiveNotes,
} from '../../domain-packs/notes-app';
import { openSimWorld } from '../../sim/world';

describe('non mutation catalog insert wakes empty hydrate', () => {
  // Chess-puzzle shaped bug: empty first sync of a world/entryChannel query,
  // then a non-mutation catalog INSERT. notify on the entry topic must wake
  // the client; without notify the snapshot stays empty until an explicit sweep.

  test('insertCatalogNote notify true wakes client after empty hydrate', async () => {
    await using world = await openSimWorld({
      domain: notesDomainPack,
      seed: 1401,
    });
    const client = await world.addClient({ id: 'alice' });

    expect(await isLiveNote(client.db, 'n-seed')).toBe(false);

    await insertCatalogNote(world.server, {
      id: 'n-seed',
      body: 'seeded',
      notify: true,
    });
    await expectLiveNote(world.server.db, 'n-seed', { body: 'seeded' });

    await world.until(async () => isLiveNote(client.db, 'n-seed'));
    await expectLiveNote(client.db, 'n-seed', { body: 'seeded' });
    await world.assertConverged();
  });

  test('insertCatalogNote notify false stays empty until nudge', async () => {
    await using world = await openSimWorld({
      domain: notesDomainPack,
      seed: 1402,
    });
    const client = await world.addClient({ id: 'alice' });

    expect(await isLiveNote(client.db, 'n-silent')).toBe(false);

    await insertCatalogNote(world.server, {
      id: 'n-silent',
      body: 'seeded-silent',
      notify: false,
    });
    await expectLiveNote(world.server.db, 'n-silent', {
      body: 'seeded-silent',
    });

    await world.never(
      async () =>
        (await readLiveNotes(client.db)).some((n) => n.id === 'n-silent'),
      { forMs: 400 }
    );
    expect(await isLiveNote(client.db, 'n-silent')).toBe(false);

    // nudge: explicit sweep — missed notify is the footgun under test
    await world.until(client.nudge());
    await expectLiveNote(client.db, 'n-silent', { body: 'seeded-silent' });
    await world.assertConverged();
  });
});
