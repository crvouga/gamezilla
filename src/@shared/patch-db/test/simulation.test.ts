import { assert } from '@/@shared/assert';
import { afterEach, describe, expect, test } from 'bun:test';
import { type Sim, patchDbScenario } from './sim/scenario';

describe('patch-db deterministic simulation', () => {
  let sim: Sim | null = null;

  afterEach(async () => {
    if (sim !== null) {
      await sim.destroy();
      sim = null;
    }
  });

  test('server useSyncHost: poll after push merges server-side patches', async () => {
    sim = await patchDbScenario()
      .server('s', { useSyncHost: true })
      .client('c', { server: 's' })
      .build();
    const srv = sim.server('s');
    const c = sim.client('c');
    const listId = crypto.randomUUID();
    await c.write([
      {
        entityId: listId,
        entityType: 'todoList',
        attributes: {
          'todoList/name': 'From client',
          'todoList/order': 0,
          'todoList/createdAt': new Date(0).toISOString(),
        },
      },
    ]);
    await c.push();
    await srv.db.write([
      {
        entityId: listId,
        entityType: 'todoList',
        attributes: { 'todoList/name': 'From other writer on server' },
      },
    ]);
    const unsub = c.subscribe.entities(
      { entityType: 'todoList', entityId: listId },
      () => {}
    );
    await c.poll();
    unsub();
    const local = await c.read([{ entityType: 'todoList', entityId: listId }]);
    const loc = local[0];
    assert.defined(loc, 'local');
    const names = loc.entities.map(
      (e) => e.attributes?.['todoList/name'] as string
    );
    expect(names.some((n) => n === 'From other writer on server')).toBe(true);
  });
});
