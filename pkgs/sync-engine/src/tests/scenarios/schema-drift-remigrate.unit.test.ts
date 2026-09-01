import { openWorld } from '@pkgs/determinism';
import { acmeSystem } from '../apps/acme/system';
import { syncFacade } from '../../sim/system';
import { describe, expect, test } from 'bun:test';
import { sql } from '@pkgs/sql';
import { acmeLocalSchemaExtraColumn, acmeRestartOptsForVariant, expectLiveNote, expectNotesMatchServer, setNote } from '../apps/acme';

describe('preserveLocalDb remigrate after additive schema', () => {
  test('restart without localSchema keeps extra column (no drift fail)', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 42,
      knobs: {
        clientCount: 0,
      },
    });
    const world = syncFacade(host.system);
    await world.addClient({
      id: 'alice',
      localSchema: acmeLocalSchemaExtraColumn,
    });
    const alice = world.clients.get('alice');
    expect(alice).toBeDefined();
    await alice!.mutate(setNote, { id: 'n1', body: 'hi' });
    await world.assertConverged();

    // Settle-style remigrate: preserve DB, omit localSchema (pack baseline).
    // Must reuse sticky upgrade schema — baseline reconcile would reject color.
    await world.node('alice').restart({ preserveLocalDb: true });

    const cols = await world.clients.get('alice')!.db.query(sql<{
      name: string;
    }>`
      SELECT name FROM pragma_table_info('notes')
    `);
    expect(cols.some((c) => c.name === 'color')).toBe(true);
    await expectLiveNote(world.clients.get('alice')!.db, 'n1', { body: 'hi' });
    await expectNotesMatchServer(
      world.clients.get('alice')!.db,
      world.server.db
    );
  });

  test('restartWithSchema then crash+preserve remigrate converges', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 43,
      knobs: {
        clientCount: 0,
        rowImageFanout: false,
        liveResendOnReconnect: false,
        bufferOutboundLive: false,
      },
    });
    const world = syncFacade(host.system);
    await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await world.node('alice').restart(acmeRestartOptsForVariant('extraColumn'));
    await world.clients
      .get('alice')!
      .mutate(setNote, { id: 'n0', body: 'from-a' });
    await b.mutate(setNote, { id: 'n1', body: 'from-b' });

    await world.node('alice').crash();
    await world.node('alice').restart({ preserveLocalDb: true });

    await world.assertConverged();
    await expectNotesMatchServer(
      world.clients.get('alice')!.db,
      world.server.db
    );
    await expectNotesMatchServer(b.db, world.server.db);
  });

  test('extraColumn then extraTable remigrate drops color via deprecation', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 44,
      knobs: {
        clientCount: 0,
      },
    });
    const world = syncFacade(host.system);
    await world.addClient({ id: 'alice' });
    await world.node('alice').restart(acmeRestartOptsForVariant('extraColumn'));
    await world.clients
      .get('alice')!
      .mutate(setNote, { id: 'n1', body: 'keep' });
    await world.assertConverged();

    await world.node('alice').restart(acmeRestartOptsForVariant('extraTable'));

    const db = world.clients.get('alice')!.db;
    const cols = await db.query(sql<{ name: string }>`
      SELECT name FROM pragma_table_info('notes')
    `);
    expect(cols.some((c) => c.name === 'color')).toBe(false);
    const tags = await db.query(sql<{ name: string }>`
      SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'tags'
    `);
    expect(tags.length).toBe(1);
    await expectLiveNote(db, 'n1', { body: 'keep' });
    await expectNotesMatchServer(db, world.server.db);
  });
});
