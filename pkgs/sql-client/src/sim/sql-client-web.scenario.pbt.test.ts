import { describe, expect, test } from 'bun:test';
import {
  bumpEpoch,
  connect,
  corruptStore,
  fillPool,
  get,
  killTabAction,
  ownerId,
  ownerRows,
  put,
  sqlClientWeb,
  tabIdList,
} from './system';

describe('sql-client web multi-tab system PBT', () => {
  test('check explores tabs, pool exhaustion, corruption, epochs', async () => {
    const report = await sqlClientWeb.explore({
      episodes: 4,
      steps: 10,
      seed: 1,
      stopOnViolation: true,
      time: { weight: 1, minMs: 0, maxMs: 5_000 },
    });
    expect(report.ok).toBe(true);
  }, 180_000);

  test('named fault pins recover to a usable cache', async () => {
    await using s1 = await sqlClientWeb.script({ seed: 1 });
    await s1.apply(fillPool);
    await s1.apply(connect, 't0');
    await s1.apply(put, { tabId: 't0', key: 'a', value: '1' });
    expect(await s1.observe(get, 't0', 'a')).toBe('1');

    await using s2 = await sqlClientWeb.script({ seed: 1 });
    await s2.apply(corruptStore);
    await s2.apply(connect, 't0');
    await s2.apply(put, { tabId: 't0', key: 'a', value: '1' });
    expect(await s2.observe(get, 't0', 'a')).toBe('1');

    await using s3 = await sqlClientWeb.script({ seed: 1 });
    await s3.apply(connect, 't0');
    await s3.apply(put, { tabId: 't0', key: 'a', value: '1' });
    await s3.apply(bumpEpoch);
    await s3.apply(killTabAction, 't0');
    await s3.apply(connect, 't0');
    // Schema-epoch bump drops the table; reconnect recovers a usable empty cache.
    expect(await s3.observe(get, 't0', 'a')).toBeNull();
    expect(await s3.observe(ownerRows)).toEqual({});

    await using s4 = await sqlClientWeb.script({ seed: 1 });
    await s4.apply(connect, 't0');
    await s4.apply(connect, 't1');
    await s4.apply(put, { tabId: 't0', key: 'a', value: '1' });
    await s4.apply(killTabAction, 't0');
    expect(await s4.observe(get, 't1', 'a')).toBe('1');
  }, 120_000);

  test('start boots a store plus tabs and elects one owner', async () => {
    await using s = await sqlClientWeb.script({ seed: 7 });
    expect(await s.observe(tabIdList)).toEqual(['t0', 't1']);
    expect(await s.observe(ownerId)).toBeNull();

    await s.apply(connect, 't0');
    await s.apply(connect, 't1');

    expect(await s.observe(ownerId)).toBe('t0');
    expect(await s.observe(ownerRows)).toEqual({});
  });
});
