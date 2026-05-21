import { afterEach, describe, expect, test } from 'bun:test';
import { assert } from '@pkgs/assert';
import { type Sim, PatchDbScenarioBuilder } from '../sim/scenario';
import { DELETED_CLAUSE } from './sync-engine/constants';
import { toAttributeState } from '../interface';
import { QTodoList } from './query-test-attrs';

describe('patch-db deterministic simulation', () => {
  let sim: Sim | null = null;

  afterEach(async () => {
    if (sim !== null) {
      await sim.destroy();
      sim = null;
    }
  });

  test('poll after push sees server-side patches from another writer', async () => {
    sim = await new PatchDbScenarioBuilder()
      .meta({
        source: {
          suite: 'patch-db deterministic simulation',
          testFile: import.meta.path,
        },
      })
      .server('s')
      .client('c', { server: 's' })
      .build();
    sim.setMeta({
      title: 'Poll sees parallel server write',
      intent: 'Client poll sees server-side patches written by another writer.',
      source: {
        testName:
          'poll after push sees server-side patches from another writer',
      },
    });
    const srv = sim.server('s');
    const c = sim.client('c');
    const listId = crypto.randomUUID();
    await c.write([
      {
        entityId: listId,
        entityType: 'todo-list',
        attributes: toAttributeState({
          'todo-list/name': 'From client',
          'todo-list/order': 0,
          'todo-list/created-at': new Date(0).toISOString(),
        }),
      },
    ]);
    await c.push();
    await srv.db.write([
      {
        entityId: listId,
        entityType: 'todo-list',
        attributes: toAttributeState({
          'todo-list/name': 'From other writer on server',
        }),
      },
    ]);
    const listQuery = {
      entityType: 'todo-list',
      where: DELETED_CLAUSE,
    } as const;
    const unsub = c.subscribe.entities(listQuery, () => {});
    await c.poll();
    const local = await c.read([{ entityType: 'todo-list', entityId: listId }]);
    const loc = local[0];
    assert.defined(loc, 'local');
    const names = loc.entities.map(
      (e) => e.attributes?.[QTodoList.name.key] as string
    );
    expect(names.some((n) => n === 'From other writer on server')).toBe(true);
    unsub();

    await sim.assertConsistent(listQuery);
  });
});
