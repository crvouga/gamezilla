import { describe, expect, test } from 'bun:test';
import { gen } from '../../fast-check';
import { start } from '../../index';
import { check } from '../../pbt';
import {
  arbSyncKnobs,
  clientNotes,
  converged,
  createNote,
  heal,
  partition,
  passTime,
  SYNC_ACTIONS,
  SYNC_PROPERTIES,
  sync,
} from './scenario';

describe('acme-sync', () => {
  test('scripted create → partition → heal → converge', async () => {
    await using run = await start(sync, {
      seed: 3,
      knobs: { clients: 2 },
      properties: SYNC_PROPERTIES,
    });

    await run.apply(partition, 'client:1');
    await run.apply(createNote, 'client:0', 'a');
    // replicate to client:1 dropped while partitioned
    expect((await run.observe(clientNotes))[1]?.n).toBe(0);

    await run.apply(heal);
    await run.apply(passTime, 100);
    expect(await run.observe(converged)).toBe(true);
  });

  test('check campaign on virtual host', async () => {
    const report = await check(sync, {
      properties: SYNC_PROPERTIES,
      actions: [...SYNC_ACTIONS],
      knobs: gen(arbSyncKnobs()),
      episodes: 3,
      steps: 10,
      seed: 11,
      stopOnViolation: true,
    });
    expect(report.ok).toBe(true);
  });
});
