import { describe, expect, test } from 'bun:test';
import { sql } from '@pkgs/sql';
import { notesDomainPack, setNote } from '../../domain-packs/notes-app';
import { RELIABLE_FAULTS } from '../../sim/faults';
import { openSimWorld } from '../../sim/world';

const IMMEDIATE_DRAIN_MS = 0;
const REPLAY_PUBLISH_MS = 40;
const PUBSUB_HOP_MS = 40;
const PEER_VISIBLE_BUDGET_MS =
  IMMEDIATE_DRAIN_MS + REPLAY_PUBLISH_MS + PUBSUB_HOP_MS;

describe('peer visibility under 200ms sim budget', () => {
  test('peer visibility under 200ms sim time', async () => {
    expect(PEER_VISIBLE_BUDGET_MS).toBeLessThan(200);
    const world = await openSimWorld({
      domain: notesDomainPack,
      seed: 19,
      faults: {
        ...RELIABLE_FAULTS,
        oneWayDelayMeanMs: PUBSUB_HOP_MS,
        oneWayDelayJitterMs: 0,
      },
    });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });
      await a.mutate(setNote, { id: 'warm', body: 'w' });
      await world.assertConverged();

      const t0 = world.clock.now();
      await a.mutate(setNote, { id: 'fast', body: 'y' });
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
    } finally {
      await world.dispose();
    }
  });
});
