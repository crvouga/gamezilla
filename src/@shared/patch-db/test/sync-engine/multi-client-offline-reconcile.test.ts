import { describe, expect, test } from 'bun:test';
import { DELETED_CLAUSE } from './constants';
import { getTwoClientSim, registerTwoClientSimHooks } from './two-client-sim';

const VIZ_FILE = import.meta.path;

registerTwoClientSimHooks();

describe('SyncPatchesDb (deterministic sim, multi-client offline)', () => {
  test('offline client diverges then reconciles with server and peer', async () => {
    const sim = getTwoClientSim();
    sim.setMeta({
      title: 'Offline client: partition, divergent edits, reconcile',
      intent:
        'After heal, push/poll merge server + peer changes; attribute conflicts resolve consistently.',
      description:
        'B partitions while A continues online; both edit shared entity; reconcile restores full entity set and merged attributes.',
      source: {
        testFile: VIZ_FILE,
        testName:
          'offline client diverges then reconciles with server and peer',
      },
    });
    const a = sim.client('a');
    const b = sim.client('b');
    const srv = sim.server('s');
    const created = new Date(0).toISOString();
    const sharedId = crypto.randomUUID();

    const listQuery = {
      entityType: 'todoList',
      where: DELETED_CLAUSE,
    } as const;
    const unsubA = a.subscribe.entities(listQuery, () => {});
    const unsubB = b.subscribe.entities(listQuery, () => {});

    await a.write([
      {
        entityId: sharedId,
        entityType: 'todoList',
        attributes: {
          'todoList/name': 'Shared',
          'todoList/order': 0,
          'todoList/createdAt': created,
        },
      },
    ]);
    await a.push();
    await b.poll();

    b.link.partition();

    const aOnlineBatch = [
      crypto.randomUUID(),
      crypto.randomUUID(),
      crypto.randomUUID(),
      crypto.randomUUID(),
    ];
    for (const [i, id] of aOnlineBatch.entries()) {
      await a.write([
        {
          entityId: id,
          entityType: 'todoList',
          attributes: {
            'todoList/name': `From-A-${i}`,
            'todoList/order': i + 1,
            'todoList/createdAt': created,
          },
        },
      ]);
    }
    await a.write([
      {
        entityId: sharedId,
        entityType: 'todoList',
        attributes: { 'todoList/name': 'Renamed-by-A-while-B-offline' },
      },
    ]);
    await a.push();

    const bOfflineNew = crypto.randomUUID();
    await b.write([
      {
        entityId: bOfflineNew,
        entityType: 'todoList',
        attributes: {
          'todoList/name': 'Created-by-B-while-offline',
          'todoList/order': 99,
          'todoList/createdAt': created,
        },
      },
    ]);
    await b.write([
      {
        entityId: sharedId,
        entityType: 'todoList',
        attributes: { 'todoList/order': 42 },
      },
    ]);

    const bWhileOffline = await b.read([
      { entityType: 'todoList', where: DELETED_CLAUSE },
    ]);
    const bOfflineIds = new Set(
      (bWhileOffline[0]?.entities ?? []).map((e) => e.entityId)
    );
    for (const id of aOnlineBatch) {
      expect(bOfflineIds.has(id)).toBe(false);
    }
    expect(bOfflineIds.has(sharedId)).toBe(true);
    expect(bOfflineIds.has(bOfflineNew)).toBe(true);

    b.link.heal();
    await b.push();
    await b.poll();
    await a.poll();
    await sim.scheduler.drain();

    unsubA();
    unsubB();

    const allIds = new Set([sharedId, ...aOnlineBatch, bOfflineNew]);

    const ra = await a.read([
      { entityType: 'todoList', where: DELETED_CLAUSE },
    ]);
    const rb = await b.read([
      { entityType: 'todoList', where: DELETED_CLAUSE },
    ]);
    const rr = await srv.db.read([
      { entityType: 'todoList', where: DELETED_CLAUSE },
    ]);
    const pick = (r: typeof ra) =>
      new Set((r[0]?.entities ?? []).map((e) => e.entityId));
    const idsA = pick(ra);
    const idsB = pick(rb);
    const idsR = pick(rr);
    for (const id of allIds) {
      expect(idsA.has(id)).toBe(true);
      expect(idsB.has(id)).toBe(true);
      expect(idsR.has(id)).toBe(true);
    }
    expect(idsA.size).toBe(idsR.size);
    expect(idsB.size).toBe(idsR.size);

    const mergedName = 'Renamed-by-A-while-B-offline';
    const sa = await a.read([{ entityType: 'todoList', entityId: sharedId }]);
    const sb = await b.read([{ entityType: 'todoList', entityId: sharedId }]);
    const sr = await srv.db.read([
      { entityType: 'todoList', entityId: sharedId },
    ]);
    expect(sa[0]?.entities[0]?.attributes?.['todoList/name']).toBe(mergedName);
    expect(sb[0]?.entities[0]?.attributes?.['todoList/name']).toBe(mergedName);
    expect(sr[0]?.entities[0]?.attributes?.['todoList/name']).toBe(mergedName);
    expect(sa[0]?.entities[0]?.attributes?.['todoList/order']).toBe(42);
    expect(sb[0]?.entities[0]?.attributes?.['todoList/order']).toBe(42);
    expect(sr[0]?.entities[0]?.attributes?.['todoList/order']).toBe(42);

    const bNameA = await a.read([
      { entityType: 'todoList', entityId: bOfflineNew },
    ]);
    expect(bNameA[0]?.entities[0]?.attributes?.['todoList/name']).toBe(
      'Created-by-B-while-offline'
    );

    await sim.assertConsistent(listQuery);
  });
});
