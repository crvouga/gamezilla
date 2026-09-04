import { describe, expect, test } from 'bun:test';
import {
  clientNotes,
  converged,
  createNote,
  heal,
  partition,
  sync,
} from './scenario';

describe('acme-sync', () => {
  test('scripted create → partition → heal → converge', async () => {
    await using s = await sync.script({ seed: 3 });

    await s.apply(partition, 'client:1');
    await s.apply(createNote, 'client:0', 'a');
    // replicate to client:1 dropped while partitioned
    expect((await s.observe(clientNotes))[1]?.n).toBe(0);

    await s.apply(heal);
    await s.until(converged);
    expect(await s.observe(converged)).toBe(true);
  });

  test('explore campaign on virtual host', async () => {
    const report = await sync.explore({
      time: { weight: 1, minMs: 0, maxMs: 5_000 },
      episodes: 3,
      steps: 10,
      seed: 11,
    });
    expect(report.ok).toBe(true);
  });
});
