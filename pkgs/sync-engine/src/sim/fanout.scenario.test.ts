import { describe, expect, test } from 'bun:test';
import { sql } from '@pkgs/sql';

import { recordPushApplied } from '../client/push-applied';
import { RELIABLE_FAULTS } from './faults';
import { SIM_WORLD_TOPIC, simDeleteNote, simSetNote } from './profile';
import { openSimWorld } from './world';

/** Happy-path latency budget components (simulated ms). */
const IMMEDIATE_DRAIN_MS = 0;
const REPLAY_PUBLISH_MS = 40;
const PUBSUB_HOP_MS = 40;
const PEER_VISIBLE_BUDGET_MS =
  IMMEDIATE_DRAIN_MS + REPLAY_PUBLISH_MS + PUBSUB_HOP_MS;

const FIXED_SEEDS = [1, 2, 42, 99] as const;

describe('fanout scenarios', () => {
  test('happy path: contiguous row fanout skips refetch', async () => {
    const world = await openSimWorld({ seed: 7, faults: RELIABLE_FAULTS });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.mutate(simSetNote, { id: 'warm', body: 'w' });
    await world.assertConverged();

    await a.mutate(simSetNote, { id: 'n1', body: 'hello' });
    await world.runFor(PEER_VISIBLE_BUDGET_MS + 50);

    const after = await b.db.query(sql<{
      id: string;
      body: string;
    }>`
      SELECT id, body FROM notes
      WHERE id = 'n1' AND _deleted_at IS NULL
    `);
    expect(after).toEqual([{ id: 'n1', body: 'hello' }]);

    const applied = await b.db.query(sql<{ last_push_seq: string }>`
      SELECT last_push_seq FROM _push_applied
      WHERE topic = ${SIM_WORLD_TOPIC}
    `);
    expect(Number(applied[0]?.last_push_seq)).toBeGreaterThanOrEqual(2);

    await world.assertConverged();
    await world.dispose();
  });

  test('dropped fanout converges via refetch', async () => {
    const world = await openSimWorld({ seed: 11, faults: RELIABLE_FAULTS });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    // Drop pubsub (and HTTP) briefly after clients are synced.
    world.network.setFaults({
      ...RELIABLE_FAULTS,
      packetLossProbability: 1,
    });
    await a.mutate(simSetNote, { id: 'n1', body: 'lost' });
    await world.runFor(50);
    world.network.setFaults(RELIABLE_FAULTS);
    world.healAll();
    await world.assertConverged();

    const rows = await b.db.query(sql<{ body: string }>`
      SELECT body FROM notes WHERE id = 'n1' AND _deleted_at IS NULL
    `);
    expect(rows[0]?.body).toBe('lost');
    await world.dispose();
  });

  test('tombstone via fanout', async () => {
    const world = await openSimWorld({ seed: 13, faults: RELIABLE_FAULTS });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.mutate(simSetNote, { id: 'n1', body: 'x' });
    await world.assertConverged();

    await a.mutate(simDeleteNote, { id: 'n1' });
    await world.assertConverged();

    const live = await b.db.query(sql<{ id: string }>`
      SELECT id FROM notes WHERE id = 'n1' AND _deleted_at IS NULL
    `);
    expect(live).toEqual([]);
    const tomb = await b.db.query(sql<{ _deleted_at: string | null }>`
      SELECT _deleted_at FROM notes WHERE id = 'n1'
    `);
    expect(tomb[0]?._deleted_at).not.toBeNull();
    await world.dispose();
  });

  test('latency budget: peer visibility under 200ms sim time', async () => {
    expect(PEER_VISIBLE_BUDGET_MS).toBeLessThan(200);
    const world = await openSimWorld({
      seed: 19,
      faults: {
        ...RELIABLE_FAULTS,
        oneWayDelayMeanMs: PUBSUB_HOP_MS,
        oneWayDelayJitterMs: 0,
      },
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await a.mutate(simSetNote, { id: 'warm', body: 'w' });
    await world.assertConverged();

    const t0 = world.clock.now();
    await a.mutate(simSetNote, { id: 'fast', body: 'y' });
    let visibleAt: number | null = null;
    for (let i = 0; i < 30; i += 1) {
      await world.runFor(10);
      const rows = await b.db.query(sql<{ body: string }>`
        SELECT body FROM notes WHERE id = 'fast' AND _deleted_at IS NULL
      `);
      if (rows[0]?.body === 'y') {
        visibleAt = world.clock.now();
        break;
      }
    }
    expect(visibleAt).not.toBeNull();
    expect((visibleAt ?? 0) - t0).toBeLessThan(200);
    await world.dispose();
  });

  test('seed sweep converges', async () => {
    for (const seed of FIXED_SEEDS) {
      const world = await openSimWorld({ seed, faults: RELIABLE_FAULTS });
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });
      await a.mutate(simSetNote, { id: `n-${seed}`, body: `b-${seed}` });
      await b.mutate(simSetNote, { id: `m-${seed}`, body: `c-${seed}` });
      await world.assertConverged();
      await world.dispose();
    }
  });

  test('epoch wipe resets tracking without crash', async () => {
    const world = await openSimWorld({ seed: 23, faults: RELIABLE_FAULTS });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await a.mutate(simSetNote, { id: 'n1', body: 'x' });
    await world.assertConverged();

    await b.db.run(sql`DELETE FROM _push_applied`);
    await a.mutate(simSetNote, { id: 'n2', body: 'y' });
    await world.assertConverged();
    await world.dispose();
  });

  test('fanout races local pending mutation on same row', async () => {
    const world = await openSimWorld({ seed: 29, faults: RELIABLE_FAULTS });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.mutate(simSetNote, { id: 'n1', body: 'from-a' });
    await world.assertConverged();

    b.lifecycle.setOnline(false);
    await b.mutate(simSetNote, { id: 'n1', body: 'from-b-pending' });
    b.lifecycle.setOnline(true);
    await a.mutate(simSetNote, { id: 'n1', body: 'from-a-2' });
    // Drain uploads + fanout/refetch until server order wins.
    await world.runFor(500);
    await world.assertConverged();
    await world.dispose();
  });

  test('recordPushApplied floor used by warm path', async () => {
    const world = await openSimWorld({ seed: 31, faults: RELIABLE_FAULTS });
    const b = await world.addClient({ id: 'bob' });
    await recordPushApplied(b.db, SIM_WORLD_TOPIC, '5');
    const rows = await b.db.query(sql<{ last_push_seq: string }>`
      SELECT last_push_seq FROM _push_applied WHERE topic = ${SIM_WORLD_TOPIC}
    `);
    expect(rows[0]?.last_push_seq).toBe('5');
    await world.dispose();
  });
});
