import { describe, expect, test } from 'bun:test';
import {
  expectLiveNote,
  acmeDomainPack,
  readLiveNotes,
  setNote,
} from '../apps/acme';
import { openSimWorld } from '../../sim/world';

const QUEUE_SIZE = 100;

describe('mutation batch over max drains without dupes', () => {
  test('queue larger than MAX_MUTATIONS_BATCH drains across batches without dupes', async () => {
    await using world = await openSimWorld({
      domain: acmeDomainPack,
      seed: 650,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.disconnect();
    for (let i = 0; i < QUEUE_SIZE; i += 1) {
      await a.mutate(setNote, {
        id: `batch-${String(i).padStart(3, '0')}`,
        body: `b${i}`,
      });
    }
    await world.runFor(50);

    await a.connect();
    await world.assertConverged();

    const server = await readLiveNotes(world.server.db);
    expect(server.length).toBe(QUEUE_SIZE);
    const ids = new Set(server.map((r) => r.id));
    expect(ids.size).toBe(QUEUE_SIZE);
    await expectLiveNote(b.db, 'batch-000', { body: 'b0' });
    await expectLiveNote(b.db, 'batch-099', { body: 'b99' });
  });
});
