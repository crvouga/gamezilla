import { describe, expect, test } from 'bun:test';
import { gen } from '../../fast-check';
import { explore, script, walk, wallHost } from '../../index';
import {
  arbKvKnobs,
  converged,
  heal,
  KV_ACTIONS,
  KV_PROPERTIES,
  kv,
  partition,
  put,
  quiet,
} from './scenario';

describe('acme-kv', () => {
  test('scripted put → partition → put → heal → converge', async () => {
    await using run = await script(kv, {
      seed: 7,
      knobs: { clients: 2 },
      properties: KV_PROPERTIES,
    });

    await run.apply(put, 'client:0', 'a', '1');
    await run.apply(partition, 'client:0');
    await run.apply(put, 'client:0', 'a', '2');
    await run.apply(heal);
    await run.elapse(100);

    expect(await run.observe(quiet)).toBe(true);
    expect(await run.observe(converged)).toBe(true);
  });

  // test('IDEAL API refactor', async () => {
  //   await using s = await kv.scripted({
  //     seed: 7,
  //     knobs: { clients: 2 },
  //   });
  //   await s.apply(put, 'client:0', 'a', '1');
  //   await s.apply(partition, 'client:0');
  //   await s.apply(put, 'client:0', 'a', '2');
  //   await s.apply(heal);
  //   await s.elapse(100);
  //   expect(await s.observe(quiet)).toBe(true);
  //   expect(await s.observe(converged)).toBe(true);
  // });

  test('explore campaign on virtual host', async () => {
    const report = await explore(kv, {
      properties: KV_PROPERTIES,
      actions: [...KV_ACTIONS],
      knobs: gen(arbKvKnobs()),
      time: { weight: 1, minMs: 0, maxMs: 5_000 },
      episodes: 3,
      steps: 10,
      seed: 42,
      stopOnViolation: true,
    });
    expect(report.ok).toBe(true);
  });

  test('walk on wall host with model network', async () => {
    const host = wallHost({ network: 'model' });
    await using run = await script(kv, {
      host,
      seed: 9,
      knobs: { clients: 2 },
      properties: KV_PROPERTIES,
    });
    const w = await walk(run, {
      actions: KV_ACTIONS.filter((a) => a.name !== 'outage'),
      steps: 8,
    });
    expect(w.choices.length).toBeGreaterThan(0);
  });
});
