import { afterEach, describe, expect, test } from 'bun:test';
import { patchDbScenario, type Sim } from '../../sim/scenario';
import { DELETED_CLAUSE } from './constants';

const VIZ_FILE = import.meta.path;

describe('SyncPatchesDb (data loss recovery)', () => {
  let sim: Sim;

  afterEach(async () => {
    await sim.destroy();
  });

  test('client and server data loss self-heals after enough sync rounds', async () => {
    sim = await patchDbScenario()
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
    await sim.wipeClientStorage('a');

    const aAfterWipe = await a.read([listQuery]);
    expect(aAfterWipe[0]?.entities.length).toBe(0);

    // A single poll recovers client A from the server's authoritative data.
    await a.poll();

    const aAfterRecovery = await a.read([listQuery]);
    expect(aAfterRecovery[0]?.entities.length).toBe(2);

    await sim.assertConsistent(listQuery);

    // ─── Phase 3: server data loss ───────────────────────────────────
    await sim.wipeServerStorage('s');

    const srvAfterWipe = await srv.db.read([listQuery]);
    expect(srvAfterWipe[0]?.entities.length).toBe(0);

    // Clearing sync markers makes clients re-push all their patches.
    await sim.markClientPatchesUnsynced('a');
    await sim.markClientPatchesUnsynced('b');

    await a.push();
    await b.push();

    // Final poll round to converge.
    await a.poll();
    await b.poll();

    const srvAfterRecovery = await srv.db.read([listQuery]);
    expect(srvAfterRecovery[0]?.entities.length).toBe(2);

    unsubA();
    unsubB();

    await sim.assertConsistent(listQuery);
  });
});
