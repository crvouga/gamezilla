import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { patchDbScenario, type Sim } from '../sim/scenario';
import { DELETED_CLAUSE } from './constants';

describe('SyncPatchesDb (deterministic sim, multi-client)', () => {
  let sim: Sim;

  beforeEach(async () => {
    sim = await patchDbScenario()
      .server('s')
      .client('a', { server: 's' })
      .client('b', { server: 's' })
      .build();
  });

  afterEach(async () => {
    await sim.destroy();
  });

  test('multi-client: second client polls after first pushes', async () => {
    const a = sim.client('a');
    const b = sim.client('b');
    const listId = crypto.randomUUID();

    await a.write([
      {
        entityId: listId,
        entityType: 'todoList',
        attributes: {
          'todoList/name': 'Shared',
          'todoList/order': 0,
          'todoList/createdAt': new Date().toISOString(),
        },
      },
    ]);
    await a.push();

    const unsub = b.subscribe.entities(
      { entityType: 'todoList', entityId: listId },
      () => {}
    );
    await b.poll();
    unsub();

    const bLocal = await b.read([{ entityType: 'todoList', entityId: listId }]);
    expect((bLocal[0]?.patches ?? []).length).toBeGreaterThanOrEqual(1);
  });

  test('multi-client: each client sees lists created by the other after poll', async () => {
    const a = sim.client('a');
    const b = sim.client('b');
    const srv = sim.server('s');
    const created = new Date(0).toISOString();
    const listA = crypto.randomUUID();
    const listB = crypto.randomUUID();

    const unsubA = a.subscribe.entities(
      { entityType: 'todoList', where: DELETED_CLAUSE },
      () => {}
    );
    const unsubB = b.subscribe.entities(
      { entityType: 'todoList', where: DELETED_CLAUSE },
      () => {}
    );

    await a.write([
      {
        entityId: listA,
        entityType: 'todoList',
        attributes: {
          'todoList/name': 'By A',
          'todoList/order': 0,
          'todoList/createdAt': created,
        },
      },
    ]);
    await b.write([
      {
        entityId: listB,
        entityType: 'todoList',
        attributes: {
          'todoList/name': 'By B',
          'todoList/order': 1,
          'todoList/createdAt': created,
        },
      },
    ]);

    await a.push();
    await b.push();

    await a.poll();
    await b.poll();

    unsubA();
    unsubB();

    const localA = await a.read([
      { entityType: 'todoList', where: DELETED_CLAUSE },
    ]);
    const localB = await b.read([
      { entityType: 'todoList', where: DELETED_CLAUSE },
    ]);
    const idsA = new Set((localA[0]?.entities ?? []).map((e) => e.entityId));
    const idsB = new Set((localB[0]?.entities ?? []).map((e) => e.entityId));
    expect(idsA.has(listA)).toBe(true);
    expect(idsA.has(listB)).toBe(true);
    expect(idsB.has(listA)).toBe(true);
    expect(idsB.has(listB)).toBe(true);

    const remoteLists = await srv.db.read([
      { entityType: 'todoList', where: DELETED_CLAUSE },
    ]);
    const idsR = new Set(
      (remoteLists[0]?.entities ?? []).map((e) => e.entityId)
    );
    expect(idsR.has(listA)).toBe(true);
    expect(idsR.has(listB)).toBe(true);
  });

  test('multi-client: offline client diverges then reconciles with server and peer', async () => {
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
  });
});
