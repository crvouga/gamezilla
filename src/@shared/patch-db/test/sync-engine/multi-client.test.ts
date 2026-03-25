import { describe, expect, test } from 'bun:test';
import { patchDbScenario } from '../sim/scenario';
import { DELETED_CLAUSE } from './constants';
import { getSim, registerSyncEngineHooks, replaceSim } from './harness';

registerSyncEngineHooks();

describe('SyncPatchesDb (deterministic sim)', () => {
  test('multi-client: second client polls after first pushes', async () => {
    await getSim().destroy();
    const rebuilt = await patchDbScenario()
      .server('s')
      .client('a', { server: 's' })
      .client('b', { server: 's' })
      .build();
    replaceSim(rebuilt);

    const a = rebuilt.client('a');
    const b = rebuilt.client('b');
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
    await getSim().destroy();
    const rebuilt = await patchDbScenario()
      .server('s')
      .client('a', { server: 's' })
      .client('b', { server: 's' })
      .build();
    replaceSim(rebuilt);

    const a = rebuilt.client('a');
    const b = rebuilt.client('b');
    const srv = rebuilt.server('s');
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
});
