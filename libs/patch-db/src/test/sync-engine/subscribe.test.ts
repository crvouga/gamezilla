import { describe, expect, test } from 'bun:test';
import { DELETED_CLAUSE } from './constants';
import { getSim, registerSyncEngineHooks } from './harness';

const VIZ_FILE = import.meta.path;

registerSyncEngineHooks();

describe('SyncPatchDb (deterministic sim)', () => {
  test('subscribe: same query stays live with one of two subscribers unsubscribed', async () => {
    const sim = getSim();
    sim.setMeta({
      title: 'Subscribe: query stays live after one subscriber leaves',
      intent:
        'Ref-counted subscription: remote updates still reach client with one active listener.',
      source: {
        testFile: VIZ_FILE,
        testName:
          'subscribe: same query stays live with one of two subscribers unsubscribed',
      },
    });
    const c = sim.client('c1');
    const srv = sim.server('s1');
    const listId = crypto.randomUUID();
    await srv.db.write([
      {
        entityId: listId,
        entityType: 'todo-list',
        attributes: {
          'todo-list/name': 'Ref',
          'todo-list/order': 0,
          'todo-list/created-at': new Date().toISOString(),
        },
      },
    ]);

    const listQuery = {
      entityType: 'todo-list',
      where: DELETED_CLAUSE,
    } as const;
    const u1 = c.subscribe.entities(listQuery, () => {});
    const u2 = c.subscribe.entities(listQuery, () => {});
    u1();

    await srv.db.write([
      {
        entityId: listId,
        entityType: 'todo-list',
        attributes: { 'todo-list/name': 'Updated After Partial Unsub' },
      },
    ]);

    await c.poll();
    u2();

    const local = await c.read([{ entityType: 'todo-list', entityId: listId }]);
    expect(
      (local[0]?.entities ?? []).some(
        (e) =>
          e.attributes?.['todo-list/name'] === 'Updated After Partial Unsub'
      )
    ).toBe(true);

    await sim.assertConsistent(listQuery);
  });

  test('subscribe.patches mirrors entities for sync lifecycle', async () => {
    const sim = getSim();
    sim.setMeta({
      title: 'Subscribe: patches stream fires after poll',
      intent:
        'subscribe.patches receives updates when merged patches arrive from poll.',
      source: {
        testFile: VIZ_FILE,
        testName: 'subscribe.patches mirrors entities for sync lifecycle',
      },
    });
    const c = sim.client('c1');
    const srv = sim.server('s1');
    const listId = crypto.randomUUID();
    await srv.db.write([
      {
        entityId: listId,
        entityType: 'todo-list',
        attributes: {
          'todo-list/name': 'Patch sub',
          'todo-list/order': 0,
          'todo-list/created-at': new Date().toISOString(),
        },
      },
    ]);

    const listQuery = {
      entityType: 'todo-list',
      where: DELETED_CLAUSE,
    } as const;
    const unsubEntities = c.subscribe.entities(listQuery, () => {});

    const notifications: number[] = [];
    const unsub = c.subscribe.patches(
      { entityType: 'todo-list', entityId: listId },
      (result) => {
        notifications.push(result.patches.length);
      }
    );

    await c.poll();
    unsub();
    unsubEntities();

    expect(notifications.some((n) => n >= 1)).toBe(true);

    await sim.assertConsistent(listQuery);
  });
});
