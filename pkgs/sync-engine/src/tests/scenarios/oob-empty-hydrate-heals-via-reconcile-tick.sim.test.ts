import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { syncFacade } from '../../sim/system';
import {
  expectLiveNote,
  insertCatalogNote,
  isLiveNote,
  readLiveNotes,
  setNote,
  writeNoteBody,
} from '../apps/acme';
import { acmeSystem } from '../apps/acme/system';

describe('oob empty hydrate heals via reconcile tick', () => {
  // Chess-puzzle shaped: empty first sync, then silent catalog INSERT.
  // Missed notifyChannels must still heal via the reconcile tick (no nudge).

  test('silent catalog insert after empty hydrate heals without nudge', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 1501,
      knobs: {
        clientCount: 0,
      },
    });
    const world = syncFacade(host.state);
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
    await using host = await openWorld(acmeSystem, {
      seed: 1502,
      knobs: {
        clientCount: 0,
      },
    });
    const world = syncFacade(host.state);
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
