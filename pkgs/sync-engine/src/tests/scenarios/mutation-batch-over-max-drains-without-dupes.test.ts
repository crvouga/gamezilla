import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  connect,
  disconnect,
  expectConverged,
  liveNote,
  liveNotes,
  mutate,
  setNote,
} from '../apps/acme';

const QUEUE_SIZE = 100;

describe('mutation batch over max drains without dupes', () => {
  test('queue larger than MAX_MUTATIONS_BATCH drains across batches without dupes', async () => {
    await using s = await acmeSystem.script({
      seed: 650,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });

    await s.apply(disconnect, 'alice');
    for (let i = 0; i < QUEUE_SIZE; i += 1) {
      await s.apply(mutate, 'alice', setNote, {
        id: `batch-${String(i).padStart(3, '0')}`,
        body: `b${i}`,
      });
    }
    await s.elapse(50);

    await s.apply(connect, 'alice');
    await expectConverged(s);

    const server = await s.observe(liveNotes, 'server');
    expect(server.length).toBe(QUEUE_SIZE);
    const ids = new Set(server.map((r) => r.id));
    expect(ids.size).toBe(QUEUE_SIZE);
    expect(await s.observe(liveNote, 'bob', 'batch-000')).toMatchObject({
      body: 'b0',
    });
    expect(await s.observe(liveNote, 'bob', 'batch-099')).toMatchObject({
      body: 'b99',
    });
  });
});
