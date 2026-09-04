import { describe, expect, test } from 'bun:test';
import { converged, heal, kv, partition, put, quiet } from './scenario';

describe('acme-kv', () => {
  test('scripted put → partition → put → heal → converge', async () => {
    await using s = await kv.script({ seed: 7 });
    await s.apply(put, 'client:0', 'a', '1');
    await s.apply(partition, 'client:0');
    await s.apply(put, 'client:0', 'a', '2');
    await s.apply(heal);
    await s.elapse(100);
    expect(await s.observe(quiet)).toBe(true);
    expect(await s.observe(converged)).toBe(true);
  });

  test('explore campaign', async () => {
    const report = await kv.explore({
      time: { weight: 1, minMs: 0, maxMs: 5_000 },
      episodes: 3,
      steps: 10,
      seed: 42,
    });
    expect(report.ok).toBe(true);
  });

  test('walk on wall-model host', async () => {
    await using s = await kv.script({
      host: 'wall-model',
      seed: 9,
    });
    const w = await s.walk({
      actions: [put, partition, heal],
      steps: 8,
    });
    expect(w.choices.length).toBeGreaterThan(0);
  });

  test('host matrix', async () => {
    expect(kv.hosts).toEqual(['virtual', 'wall-model']);
  });
});
