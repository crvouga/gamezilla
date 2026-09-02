import { describe, expect, test } from 'bun:test';
import { expectLiveNote, insertCatalogNote, isLiveNote } from '../apps/acme';
import { openAcmeWorld } from '../apps/acme/system';

describe('non mutation catalog insert wakes empty hydrate', () => {
  // Chess-puzzle shaped bug: empty first sync of a world/entryChannel query,
  // then a non-mutation catalog INSERT. notify on the entry topic must wake
  // the client fast; without notify the reconcile tick still heals.

  test('insertCatalogNote notify true wakes client after empty hydrate', async () => {
    await using world = await openAcmeWorld({
      seed: 1401,
      knobs: {
        clientCount: 0,
      },
    });

    const client = await world.addClient({ id: 'alice' });

    expect(await isLiveNote(client.db, 'n-seed')).toBe(false);

    await insertCatalogNote(world.server, {
      id: 'n-seed',
      body: 'seeded',
      notify: true,
    });
    await expectLiveNote(world.server.db, 'n-seed', { body: 'seeded' });

    await world.waitUntil(async () => isLiveNote(client.db, 'n-seed'));
    await expectLiveNote(client.db, 'n-seed', { body: 'seeded' });
    await world.assertConverged();
  });

  test('insertCatalogNote notify false heals via reconcile tick', async () => {
    await using world = await openAcmeWorld({
      seed: 1402,
      knobs: {
        clientCount: 0,
      },
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

    // No notify → no instant wake; reconcile tick heals below.
    expect(await isLiveNote(client.db, 'n-silent')).toBe(false);

    await world.waitUntil(async () => isLiveNote(client.db, 'n-silent'));
    await expectLiveNote(client.db, 'n-silent', { body: 'seeded-silent' });
    await world.assertConverged();
  });
});
