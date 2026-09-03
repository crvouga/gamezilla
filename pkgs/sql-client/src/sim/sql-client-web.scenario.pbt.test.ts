import { describe, expect, test } from 'bun:test';
import { explore, script } from '@pkgs/dst';
import { gen } from '@pkgs/dst/fast-check';
import {
  arbSqlClientWebKnobs,
  bumpEpoch,
  connect,
  corruptStore,
  fillPool,
  get,
  killTabAction,
  ownerId,
  ownerRows,
  put,
  SQL_CLIENT_WEB_ACTIONS,
  SQL_CLIENT_WEB_PROPERTIES,
  type SqlClientWebKnobs,
  sqlClientWeb,
  tabIdList,
} from './system';

/** tabCount=2, poolCapacity=6, schemaEpoch=1, backend=web-sim-opfs */
const OPFS_KNOBS: SqlClientWebKnobs = {
  tabCount: 2,
  poolCapacity: 6,
  schemaEpoch: 1,
  backend: 'web-sim-opfs',
};

describe('sql-client web multi-tab system PBT', () => {
  test('check explores tabs, pool exhaustion, corruption, epochs', async () => {
    const report = await explore(sqlClientWeb, {
      properties: SQL_CLIENT_WEB_PROPERTIES,
      actions: SQL_CLIENT_WEB_ACTIONS,
      knobs: gen(arbSqlClientWebKnobs()),
      episodes: 4,
      steps: 10,
      seed: 1,
      stopOnViolation: true,
      time: { weight: 1, minMs: 0, maxMs: 5_000 },
    });
    expect(report.ok).toBe(true);
  }, 180_000);

  test('named fault pins recover to a usable cache', async () => {
    await using run1 = await script(sqlClientWeb, {
      seed: 1,
      knobs: OPFS_KNOBS,
      properties: SQL_CLIENT_WEB_PROPERTIES,
    });
    await run1.apply(fillPool);
    await run1.apply(connect, 't0');
    await run1.apply(put, { tabId: 't0', key: 'a', value: '1' });
    expect(await run1.observe(get, 't0', 'a')).toBe('1');

    await using run2 = await script(sqlClientWeb, {
      seed: 1,
      knobs: OPFS_KNOBS,
      properties: SQL_CLIENT_WEB_PROPERTIES,
    });
    await run2.apply(corruptStore);
    await run2.apply(connect, 't0');
    await run2.apply(put, { tabId: 't0', key: 'a', value: '1' });
    expect(await run2.observe(get, 't0', 'a')).toBe('1');

    await using run3 = await script(sqlClientWeb, {
      seed: 1,
      knobs: OPFS_KNOBS,
      properties: SQL_CLIENT_WEB_PROPERTIES,
    });
    await run3.apply(connect, 't0');
    await run3.apply(put, { tabId: 't0', key: 'a', value: '1' });
    await run3.apply(bumpEpoch);
    await run3.apply(killTabAction, 't0');
    await run3.apply(connect, 't0');
    // Schema-epoch bump drops the table; reconnect recovers a usable empty cache.
    expect(await run3.observe(get, 't0', 'a')).toBeNull();
    expect(await run3.observe(ownerRows)).toEqual({});

    await using run4 = await script(sqlClientWeb, {
      seed: 1,
      knobs: OPFS_KNOBS,
      properties: SQL_CLIENT_WEB_PROPERTIES,
    });
    await run4.apply(connect, 't0');
    await run4.apply(connect, 't1');
    await run4.apply(put, { tabId: 't0', key: 'a', value: '1' });
    await run4.apply(killTabAction, 't0');
    expect(await run4.observe(get, 't1', 'a')).toBe('1');
  }, 120_000);

  test('start boots a store plus tabs and elects one owner', async () => {
    await using run = await script(sqlClientWeb, {
      seed: 7,
      knobs: OPFS_KNOBS,
      properties: SQL_CLIENT_WEB_PROPERTIES,
    });
    expect(await run.observe(tabIdList)).toEqual(['t0', 't1']);
    expect(await run.observe(ownerId)).toBeNull();

    await run.apply(connect, 't0');
    await run.apply(connect, 't1');

    expect(await run.observe(ownerId)).toBe('t0');
    expect(await run.observe(ownerRows)).toEqual({});
  });
});
