import { describe, expect, test } from 'bun:test';
import { script } from '@pkgs/dst';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  connect,
  disconnect,
  expectConverged,
  liveNote,
  liveNotes,
  mutate,
  setNote,
  syncVirtualHost,
} from '../apps/acme';

const QUEUE_SIZE = 100;

describe('mutation batch over max drains without dupes', () => {
  test('queue larger than MAX_MUTATIONS_BATCH drains across batches without dupes', async () => {
    await using run = await script(acmeSystem, {
      seed: 650,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });

    await run.apply(disconnect, 'alice');
    for (let i = 0; i < QUEUE_SIZE; i += 1) {
      await run.apply(mutate, 'alice', setNote, {
        id: `batch-${String(i).padStart(3, '0')}`,
        body: `b${i}`,
      });
    }
    await run.elapse(50);

    await run.apply(connect, 'alice');
    await expectConverged(run);

    const server = await run.observe(liveNotes, 'server');
    expect(server.length).toBe(QUEUE_SIZE);
    const ids = new Set(server.map((r) => r.id));
    expect(ids.size).toBe(QUEUE_SIZE);
    expect(await run.observe(liveNote, 'bob', 'batch-000')).toMatchObject({
      body: 'b0',
    });
    expect(await run.observe(liveNote, 'bob', 'batch-099')).toMatchObject({
      body: 'b99',
    });
  });
});
