import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import { gen } from '@pkgs/dst/fast-check';
import { check } from '@pkgs/dst/pbt';
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
    const report = await check(sqlClientWeb, {
      properties: SQL_CLIENT_WEB_PROPERTIES,
      actions: SQL_CLIENT_WEB_ACTIONS,
      knobs: gen(arbSqlClientWebKnobs()),
      episodes: 4,
      steps: 10,
      seed: 1,
      stopOnViolation: true,
    });
    expect(report.ok).toBe(true);
  }, 180_000);

  test('named fault pins recover to a usable cache', async () => {
    await using run1 = await start(sqlClientWeb, {
      seed: 1,
      knobs: OPFS_KNOBS,
      properties: SQL_CLIENT_WEB_PROPERTIES,
    });
    await run1.apply(fillPool);
    await run1.apply(connect, 't0');
    await run1.apply(put, { tabId: 't0', key: 'a', value: '1' });
    await run1.apply(get, { tabId: 't0', key: 'a' });

    await using run2 = await start(sqlClientWeb, {
      seed: 1,
      knobs: OPFS_KNOBS,
      properties: SQL_CLIENT_WEB_PROPERTIES,
    });
    await run2.apply(corruptStore);
    await run2.apply(connect, 't0');
    await run2.apply(put, { tabId: 't0', key: 'a', value: '1' });
    await run2.apply(get, { tabId: 't0', key: 'a' });

    await using run3 = await start(sqlClientWeb, {
      seed: 1,
      knobs: OPFS_KNOBS,
      properties: SQL_CLIENT_WEB_PROPERTIES,
    });
    await run3.apply(connect, 't0');
    await run3.apply(put, { tabId: 't0', key: 'a', value: '1' });
    await run3.apply(bumpEpoch);
    await run3.apply(killTabAction, 't0');
    await run3.apply(connect, 't0');
    await run3.apply(get, { tabId: 't0', key: 'a' });

    await using run4 = await start(sqlClientWeb, {
      seed: 1,
      knobs: OPFS_KNOBS,
      properties: SQL_CLIENT_WEB_PROPERTIES,
    });
    await run4.apply(connect, 't0');
    await run4.apply(connect, 't1');
    await run4.apply(put, { tabId: 't0', key: 'a', value: '1' });
    await run4.apply(killTabAction, 't0');
    await run4.apply(get, { tabId: 't1', key: 'a' });
  }, 120_000);

  test('start boots a store plus tabs and elects one owner', async () => {
    await using run = await start(sqlClientWeb, {
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
