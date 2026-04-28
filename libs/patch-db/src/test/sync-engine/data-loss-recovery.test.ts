import { afterEach, describe, expect, test } from 'bun:test';
import type { PatchesDbQuery } from '../../interface';
import { PatchDbScenarioBuilder, type Sim } from '../../sim/scenario';
import { DELETED_CLAUSE } from './constants';

const VIZ_FILE = import.meta.path;

describe('SyncPatchesDb (data loss recovery)', () => {
  let sim: Sim;

  afterEach(async () => {
    await sim.destroy();
  });

  test('push after server wipe re-anchors unsynced patch when synced parent is absent (no subscriptions)', async () => {
    sim = await new PatchDbScenarioBuilder()
      .server('s')
      .client('a', { server: 's' })
      .build();

    const client = sim.client('a');
    const srv = sim.server('s');
    const entityId = crypto.randomUUID();
    const created = new Date(0).toISOString();

    await client.write([
      {
        entityId,
        entityType: 'todoList',
        attributes: {
          'todoList/name': 'Root',
          'todoList/order': 0,
          'todoList/createdAt': created,
        },
      },
    ]);
    await client.push();

    let [allServer] = await srv.db.read([{ on: 'patches' }]);
    expect(allServer?.patches.length).toBe(1);

    await srv.wipeStorage();
    [allServer] = await srv.db.read([{ on: 'patches' }]);
    expect(allServer?.patches.length).toBe(0);

    await client.write([
      {
        entityId,
        entityType: 'todoList',
        attributes: {
          'todoList/name': 'After wipe',
          'todoList/order': 1,
          'todoList/createdAt': created,
        },
      },
    ]);

    await client.push();
    [allServer] = await srv.db.read([{ on: 'patches' }]);
    // Server write attaches the new patch to the current chain head (null when DB was wiped).
    expect(allServer?.patches.length).toBe(1);

    await client.push();
    [allServer] = await srv.db.read([{ on: 'patches' }]);
    expect(allServer?.patches.length).toBe(1);
  });

  test('server wipe + concurrent offline writes converge to same order', async () => {
    sim = await new PatchDbScenarioBuilder()
      .server('s')
      .client('a', { server: 's' })
      .client('b', { server: 's' })
      .build();

    const a = sim.client('a');
    const b = sim.client('b');
    const srv = sim.server('s');
    const created = new Date(0).toISOString();

    const orderedQuery: PatchesDbQuery = {
      entityType: 'todoList',
      where: DELETED_CLAUSE,
      orderBy: [{ attribute: 'todoList/order', direction: 'asc' }],
    };
    const unsubA = a.subscribe.entities(orderedQuery, () => {});
    const unsubB = b.subscribe.entities(orderedQuery, () => {});

    // ─── baseline: two synced items ───────────────────────────────────
    const x = crypto.randomUUID();
    const y = crypto.randomUUID();

    await a.write([
      {
        entityId: x,
        entityType: 'todoList',
        attributes: {
          'todoList/name': 'X',
          'todoList/order': 0,
          'todoList/createdAt': created,
        },
      },
    ]);
    await a.push();
    await b.poll();

    await b.write([
      {
        entityId: y,
        entityType: 'todoList',
        attributes: {
          'todoList/name': 'Y',
          'todoList/order': 1,
          'todoList/createdAt': created,
        },
      },
    ]);
    await b.push();
    await a.poll();
    await b.poll();

    await sim.assertConsistent(orderedQuery);

    // ─── server wipe (simulate data loss) ─────────────────────────────
    await srv.wipeStorage();

    // ─── both clients create a shape offline (same order value) ───────
    const z = crypto.randomUUID();
    const w = crypto.randomUUID();

    await a.write([
      {
        entityId: z,
        entityType: 'todoList',
        attributes: {
          'todoList/name': 'Z',
          'todoList/order': 2,
          'todoList/createdAt': created,
        },
      },
    ]);
    await b.write([
      {
        entityId: w,
        entityType: 'todoList',
        attributes: {
          'todoList/name': 'W',
          'todoList/order': 2,
          'todoList/createdAt': created,
        },
      },
    ]);

    // ─── reconnect: push+poll detects server data loss, then re-push converges ──
    await a.push();
    await b.push();
    await a.poll();
    await b.poll();
    await a.push();
    await b.push();
    await a.poll();
    await b.poll();

    // entity sets and attributes must match
    await sim.assertConsistent(orderedQuery);

    // read order must be identical across every node
    const [aRes] = await a.read([orderedQuery]);
    const [bRes] = await b.read([orderedQuery]);
    const [sRes] = await srv.db.read([orderedQuery]);

    const ids = (r: typeof aRes) => r?.entities.map((e) => e.entityId);

    expect(ids(aRes)).toEqual(ids(sRes));
    expect(ids(bRes)).toEqual(ids(sRes));

    unsubA();
    unsubB();
  });

  test('client and server data loss self-heals after enough sync rounds', async () => {
    sim = await new PatchDbScenarioBuilder()
      .meta({
        source: { suite: 'sync-engine (data loss recovery)' },
      })
      .server('s')
      .client('a', { server: 's' })
      .client('b', { server: 's' })
      .build();
    sim.setMeta({
      enableViz: true,
      title: 'Data loss recovery: client wipe + server wipe self-heal',
      intent:
        'After catastrophic data loss on a client or the server, push/poll cycles restore full consistency.',
      source: {
        testFile: VIZ_FILE,
        testName:
          'client and server data loss self-heals after enough sync rounds',
      },
    });

    const a = sim.client('a');
    const b = sim.client('b');
    const srv = sim.server('s');
    const created = new Date(0).toISOString();

    const listQuery = {
      entityType: 'todoList',
      where: DELETED_CLAUSE,
    } as const;
    const unsubA = a.subscribe.entities(listQuery, () => {});
    const unsubB = b.subscribe.entities(listQuery, () => {});

    // ─── Phase 1: establish a synced baseline ────────────────────────
    const entityX = crypto.randomUUID();
    const entityY = crypto.randomUUID();

    await a.write([
      {
        entityId: entityX,
        entityType: 'todoList',
        attributes: {
          'todoList/name': 'List-X',
          'todoList/order': 0,
          'todoList/createdAt': created,
        },
      },
    ]);
    await a.push();
    await b.poll();

    await b.write([
      {
        entityId: entityY,
        entityType: 'todoList',
        attributes: {
          'todoList/name': 'List-Y',
          'todoList/order': 1,
          'todoList/createdAt': created,
        },
      },
    ]);
    await b.push();
    await a.poll();
    await b.poll();

    await sim.assertConsistent(listQuery);

    // ─── Phase 2: client data loss ───────────────────────────────────
    await a.wipeStorage();

    const aAfterWipe = await a.read([listQuery]);
    expect(aAfterWipe[0]?.entities.length).toBe(0);

    // A single poll recovers client A from the server's authoritative data.
    await a.poll();

    const aAfterRecovery = await a.read([listQuery]);
    expect(aAfterRecovery[0]?.entities.length).toBe(2);

    await sim.assertConsistent(listQuery);

    // ─── Phase 3: server data loss ───────────────────────────────────
    await srv.wipeStorage();

    const srvAfterWipe = await srv.db.read([listQuery]);
    expect(srvAfterWipe[0]?.entities.length).toBe(0);

    // Poll detects missing synced patches → marks them unsynced.
    // Push re-sends them. Extra round to converge.
    await a.push();
    await b.push();
    await a.poll();
    await b.poll();
    await a.push();
    await b.push();
    await a.poll();
    await b.poll();

    const srvAfterRecovery = await srv.db.read([listQuery]);
    expect(srvAfterRecovery[0]?.entities.length).toBe(2);

    unsubA();
    unsubB();

    await sim.assertConsistent(listQuery);
  });
});
