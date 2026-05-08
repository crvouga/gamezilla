import { describe, expect, test } from 'bun:test';
import { DELETED_CLAUSE } from './constants';
import { getTwoClientSim, registerTwoClientSimHooks } from './two-client-sim';

const VIZ_FILE = import.meta.path;

registerTwoClientSimHooks();

describe('SyncPatchDb (deterministic sim, multi-client)', () => {
  test('multi-client: second client polls after first pushes', async () => {
    const sim = getTwoClientSim();
    sim.setMeta({
      title: 'Multi-client: B receives A’s data after poll',
      intent:
        'Second client merges remote patches created by the first client.',
      source: {
        testFile: VIZ_FILE,
        testName: 'multi-client: second client polls after first pushes',
      },
    });
    const a = sim.client('a');
    const b = sim.client('b');
    const listId = crypto.randomUUID();
    const listQuery = {
      entityType: 'todo-list',
      where: DELETED_CLAUSE,
    } as const;
    const unsubA = a.subscribe.entities(listQuery, () => {});
    const unsubB = b.subscribe.entities(listQuery, () => {});

    await a.write([
      {
        entityId: listId,
        entityType: 'todo-list',
        attributes: {
          'todo-list/name': 'Shared',
          'todo-list/order': 0,
          'todo-list/created-at': new Date().toISOString(),
        },
      },
    ]);
    await a.push();

    await a.poll();
    await b.poll();

    const bLocal = await b.read([
      { entityType: 'todo-list', entityId: listId },
    ]);
    expect((bLocal[0]?.patches ?? []).length).toBeGreaterThanOrEqual(1);

    unsubA();
    unsubB();

    await sim.assertConsistent(listQuery);
  });

  test('multi-client: each client sees lists created by the other after poll', async () => {
    const sim = getTwoClientSim();
    sim.setMeta({
      title: 'Multi-client: cross visibility after push + poll',
      intent: 'Each peer’s writes appear in the other’s list query after sync.',
      source: {
        testFile: VIZ_FILE,
        testName:
          'multi-client: each client sees lists created by the other after poll',
      },
    });
    const a = sim.client('a');
    const b = sim.client('b');
    const srv = sim.server('s');
    const created = new Date(0).toISOString();
    const listA = crypto.randomUUID();
    const listB = crypto.randomUUID();

    const unsubA = a.subscribe.entities(
      { entityType: 'todo-list', where: DELETED_CLAUSE },
      () => {}
    );
    const unsubB = b.subscribe.entities(
      { entityType: 'todo-list', where: DELETED_CLAUSE },
      () => {}
    );

    await a.write([
      {
        entityId: listA,
        entityType: 'todo-list',
        attributes: {
          'todo-list/name': 'By A',
          'todo-list/order': 0,
          'todo-list/created-at': created,
        },
      },
    ]);
    await b.write([
      {
        entityId: listB,
        entityType: 'todo-list',
        attributes: {
          'todo-list/name': 'By B',
          'todo-list/order': 1,
          'todo-list/created-at': created,
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
      { entityType: 'todo-list', where: DELETED_CLAUSE },
    ]);
    const localB = await b.read([
      { entityType: 'todo-list', where: DELETED_CLAUSE },
    ]);
    const idsA = new Set((localA[0]?.entities ?? []).map((e) => e.entityId));
    const idsB = new Set((localB[0]?.entities ?? []).map((e) => e.entityId));
    expect(idsA.has(listA)).toBe(true);
    expect(idsA.has(listB)).toBe(true);
    expect(idsB.has(listA)).toBe(true);
    expect(idsB.has(listB)).toBe(true);

    const remoteLists = await srv.db.read([
      { entityType: 'todo-list', where: DELETED_CLAUSE },
    ]);
    const idsR = new Set(
      (remoteLists[0]?.entities ?? []).map((e) => e.entityId)
    );
    expect(idsR.has(listA)).toBe(true);
    expect(idsR.has(listB)).toBe(true);

    await sim.assertConsistent({
      entityType: 'todo-list',
      where: DELETED_CLAUSE,
    });
  });
});
