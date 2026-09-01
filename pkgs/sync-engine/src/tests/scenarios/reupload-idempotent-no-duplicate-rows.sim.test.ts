import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { expectLiveNote, readLiveNotes, setNote } from '../apps/acme';
import { acmeSystem } from '../apps/acme/system';

describe('reupload idempotent no duplicate rows', () => {
  test('reconnect after offline set does not duplicate domain rows', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 70,
      knobs: {
        clientCount: 0,
      },
    });
    const world = host.facade;
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    a.online(false);
    await a.mutate(setNote, { id: 'n1', body: 'once' });
    a.online(true);
    await world.assertConverged();

    // Force another upload cycle via brief offline/online.
    a.online(false);
    await world.runFor(20);
    a.online(true);
    await world.assertConverged();

    await expectLiveNote(b.db, 'n1', { body: 'once' });
    const server = await readLiveNotes(world.server.db);
    expect(server.filter((r) => r.id === 'n1')).toHaveLength(1);
  });

  test('repeated setNote on same id keeps single live row', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 71,
      knobs: {
        clientCount: 0,
      },
    });
    const world = host.facade;
    const a = await world.addClient({ id: 'alice' });
    await a.mutate(setNote, { id: 'n1', body: 'v1' });
    await a.mutate(setNote, { id: 'n1', body: 'v2' });
    await a.mutate(setNote, { id: 'n1', body: 'v3' });
    await world.assertConverged();
    const server = await readLiveNotes(world.server.db);
    expect(server.filter((r) => r.id === 'n1')).toHaveLength(1);
    await expectLiveNote(a.db, 'n1', { body: 'v3' });
  });
});
