import { describe, expect, test } from 'bun:test';
import { start, walk, wallHost } from '../../index';
import { check } from '../../pbt';
import {
  converged,
  heal,
  KV_ACTIONS,
  KV_PROPERTIES,
  kv,
  partition,
  passTime,
  put,
  quiet,
} from './scenario';

describe('acme-kv', () => {
  test('scripted put → partition → put → heal → converge', async () => {
    await using run = await start(kv, {
      seed: 7,
      draws: [2],
      properties: KV_PROPERTIES,
    });

    await run.apply(put, {
      client: 'client:0',
      key: 'a',
      value: '1',
    });
    await run.apply(partition, 'client:0');
    await run.apply(put, {
      client: 'client:0',
      key: 'a',
      value: '2',
    });
    await run.apply(heal);
    await run.apply(passTime, 100);

    expect(await run.observe(quiet)).toBe(true);
    expect(await run.observe(converged)).toBe(true);
  });

  test('check campaign on virtual host', async () => {
    const report = await check(kv, {
      properties: KV_PROPERTIES,
      actions: KV_ACTIONS,
      episodes: 3,
      steps: 10,
      seed: 42,
      stopOnViolation: true,
    });
    expect(report.ok).toBe(true);
  });

  test('walk on wall host with model network', async () => {
    const host = wallHost({ network: 'model' });
    await using run = await start(kv, {
      host,
      seed: 9,
      draws: [2],
      properties: KV_PROPERTIES,
    });
    const w = await walk(run, {
      actions: KV_ACTIONS.filter(
        (a) => a.name !== 'passTime' && a.name !== 'outage'
      ),
      steps: 8,
    });
    expect(w.choices.length).toBeGreaterThan(0);
  });
});
