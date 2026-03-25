import { assert } from '@/@shared/assert';
import { afterEach, describe, expect, test } from 'bun:test';
import {
  BuiltPatchDbScenario,
  PatchDbSimDSL,
  patchDbScenario,
} from './sim/scenario';

describe('patch-db deterministic simulation', () => {
  let sim: BuiltPatchDbScenario | null = null;

  afterEach(async () => {
    if (sim !== null) {
      await sim.destroy();
      sim = null;
    }
  });

  test('PatchDbSimDSL: partition, heal, flush', async () => {
    sim = await patchDbScenario()
      .server('s')
      .client('c', { server: 's' })
      .build();
    const dsl = new PatchDbSimDSL().partition('c', 's').heal('c', 's').flush();
    await dsl.runWith(sim);
  });

  test('server useSyncHost: poll after push merges server-side patches', async () => {
    sim = await patchDbScenario()
      .server('s', { useSyncHost: true })
      .client('c', { server: 's' })
      .build();
    const srv = sim.getServer('s');
    const c = sim.getClient('c');
    const listId = crypto.randomUUID();
    await c.syncDb.write([
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
    await c.runPush();
    await srv.authority.write([
      {
        entityId: listId,
        entityType: 'todoList',
        attributes: { 'todoList/name': 'From other writer on server' },
      },
    ]);
    const unsub = c.syncDb.subscribe.entities(
      { entityType: 'todoList', entityId: listId },
      () => {}
    );
    await c.runPoll();
    for (let i = 0; i < 32; i++) {
      await Promise.resolve();
    }
    unsub();
    const local = await c.localDb.read([
      { entityType: 'todoList', entityId: listId },
    ]);
    const loc = local[0];
    assert.defined(loc, 'local');
    const names = loc.entities.map(
      (e) => e.attributes?.['todoList/name'] as string
    );
    expect(names.some((n) => n === 'From other writer on server')).toBe(true);
  });
});
