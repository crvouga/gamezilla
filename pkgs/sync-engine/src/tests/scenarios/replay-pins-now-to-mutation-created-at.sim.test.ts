import { openWorld } from '@pkgs/determinism';
import { acmeSystem } from '../apps/acme/system';
import { syncFacade } from '../../sim/system';
import { describe, expect, test } from 'bun:test';
import { deleteNote, expectLiveNote, expectNoteNotLive, readNoteTombstone, setNote } from '../apps/acme';

describe('replay pins now to mutation created at', () => {
  test('replay pins env.now to mutation createdAt under client clock skew', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 720,
      knobs: {
        clientCount: 0,
      },
    });
    const world = syncFacade(host.system);
    using _sa = world.node('alice').skewClock(-60_000);
    using _sb = world.node('bob').skewClock(0);
    using _ss = world.node('server').skewClock(60_000);

    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.mutate(setNote, { id: 'n1', body: 'live' });
    await world.assertConverged();

    await a.disconnect();
    const skewedNow = world.node('alice').now();
    const del = await a.mutate(deleteNote, { id: 'n1' });
    expect(del.ok).toBe(true);
    const expectedIso = new Date(skewedNow).toISOString();

    await a.connect();
    await world.assertConverged();

    await expectNoteNotLive(a.db, 'n1');
    await expectNoteNotLive(b.db, 'n1');
    await expectNoteNotLive(world.server.db, 'n1');

    expect(await readNoteTombstone(world.server.db, 'n1')).toBe(expectedIso);
    expect(await readNoteTombstone(b.db, 'n1')).toBe(expectedIso);
    expect(await readNoteTombstone(a.db, 'n1')).toBe(expectedIso);
  });

  test('rebase env.now pinned to createdAt under skew before upload', async () => {
    // Offline pending delete + peer merge before upload: rebase uses createdAt.
    await using host = await openWorld(acmeSystem, {
      seed: 721,
      knobs: {
        clientCount: 0,
      },
    });
    const world = syncFacade(host.system);
    using _sa = world.node('alice').skewClock(-120_000);
    using _sb = world.node('bob').skewClock(0);
    using _ss = world.node('server').skewClock(90_000);

    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.mutate(setNote, { id: 'n1', body: 'live' });
    await world.assertConverged();

    await a.disconnect();
    const skewedNow = world.node('alice').now();
    const del = await a.mutate(deleteNote, { id: 'n1' });
    expect(del.ok).toBe(true);
    const expectedIso = new Date(skewedNow).toISOString();
    await expectNoteNotLive(a.db, 'n1');
    expect(await readNoteTombstone(a.db, 'n1')).toBe(expectedIso);

    // Peer write forces alice merge+rebase on reconnect before upload.
    await b.mutate(setNote, { id: 'n2', body: 'peer' });
    await world.runFor(200);

    await a.connect();
    await world.runFor(100);
    // Rebase must keep tombstone stamped with mutation createdAt, not wall now.
    expect(await readNoteTombstone(a.db, 'n1')).toBe(expectedIso);

    await world.assertConverged();

    await expectNoteNotLive(a.db, 'n1');
    await expectNoteNotLive(b.db, 'n1');
    await expectNoteNotLive(world.server.db, 'n1');
    expect(await readNoteTombstone(world.server.db, 'n1')).toBe(expectedIso);
    expect(await readNoteTombstone(b.db, 'n1')).toBe(expectedIso);
    await expectLiveNote(b.db, 'n2', { body: 'peer' });
  });
});
