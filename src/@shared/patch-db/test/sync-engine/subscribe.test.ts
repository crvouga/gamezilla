import { describe, expect, test } from 'bun:test';
import { getSim, registerSyncEngineHooks } from './harness';

registerSyncEngineHooks();

describe('SyncPatchesDb (deterministic sim)', () => {
  test('subscribe: same query stays live with one of two subscribers unsubscribed', async () => {
    const sim = getSim();
    const c = sim.client('c1');
    const srv = sim.server('s1');
    const listId = crypto.randomUUID();
    await srv.db.write([
      {
        entityId: listId,
        entityType: 'todoList',
        attributes: {
          'todoList/name': 'Ref',
          'todoList/order': 0,
          'todoList/createdAt': new Date().toISOString(),
        },
      },
    ]);

    const q = { entityType: 'todoList', entityId: listId } as const;
    const u1 = c.subscribe.entities(q, () => {});
    const u2 = c.subscribe.entities(q, () => {});
    u1();

    await srv.db.write([
      {
        entityId: listId,
        entityType: 'todoList',
        attributes: { 'todoList/name': 'Updated After Partial Unsub' },
      },
    ]);

    await c.poll();
    u2();

    const local = await c.read([q]);
    expect(
      (local[0]?.entities ?? []).some(
        (e) => e.attributes?.['todoList/name'] === 'Updated After Partial Unsub'
      )
    ).toBe(true);
  });

  test('subscribe.patches mirrors entities for sync lifecycle', async () => {
    const sim = getSim();
    const c = sim.client('c1');
    const srv = sim.server('s1');
    const listId = crypto.randomUUID();
    await srv.db.write([
      {
        entityId: listId,
        entityType: 'todoList',
        attributes: {
          'todoList/name': 'Patch sub',
          'todoList/order': 0,
          'todoList/createdAt': new Date().toISOString(),
        },
      },
    ]);

    const notifications: number[] = [];
    const unsub = c.subscribe.patches(
      { entityType: 'todoList', entityId: listId },
      (result) => {
        notifications.push(result.patches.length);
      }
    );

    await c.poll();
    unsub();

    expect(notifications.some((n) => n >= 1)).toBe(true);
  });
});
