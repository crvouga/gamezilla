import { describe, expect, test } from 'bun:test';
import { sql } from '@pkgs/sql';
import {
  expectLiveNote,
  expectNoteNotLive,
  notesDomainPack,
  setNote,
} from '../../domain-packs/notes-app';
import { RELIABLE_FAULTS } from '../../sim/faults';
import { openSimWorld } from '../../sim/world';

const PEER_VISIBLE_BUDGET_MS = 200;

describe('buffer outbound live flush on reconnect', () => {
  test('default: no outbound buffer; peers wait for upload/sync', async () => {
    const world = await openSimWorld({
      domain: notesDomainPack,
      seed: 701,
      faults: RELIABLE_FAULTS,
    });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });
      await a.mutate(setNote, { id: 'warm', body: 'w' });
      await world.assertConverged();

      await a.engine.disconnect();
      world.hold('alice', 'sync');
      await a.mutate(setNote, { id: 'n1', body: 'while-down' });
      await a.engine.connect();
      await world.runFor(200);
      await expectNoteNotLive(b.db, 'n1');

      world.release('alice', 'sync');
      await world.assertConverged();
      await expectLiveNote(b.db, 'n1', { body: 'while-down' });
    } finally {
      await world.dispose();
    }
  });

  test('bufferOutboundLive: peer sees note while publisher sync held', async () => {
    const world = await openSimWorld({
      domain: notesDomainPack,
      seed: 702,
      faults: RELIABLE_FAULTS,
      bufferOutboundLive: true,
    });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });
      await a.mutate(setNote, { id: 'warm', body: 'w' });
      await world.assertConverged();

      await a.engine.disconnect();
      world.hold('alice', 'sync');
      await a.mutate(setNote, { id: 'n1', body: 'buffered' });
      await a.engine.connect();
      await world.runFor(200);
      await expectLiveNote(b.db, 'n1', { body: 'buffered' });

      world.release('alice', 'sync');
      await world.assertConverged();
      await expectLiveNote(b.db, 'n1', { body: 'buffered' });
    } finally {
      await world.dispose();
    }
  });

  test('bufferOutboundLive: peer visible under latency budget via live', async () => {
    const world = await openSimWorld({
      domain: notesDomainPack,
      seed: 703,
      faults: RELIABLE_FAULTS,
      bufferOutboundLive: true,
    });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });
      await a.mutate(setNote, { id: 'warm', body: 'w' });
      await world.assertConverged();

      await a.engine.disconnect();
      world.hold('bob', 'sync');
      await a.mutate(setNote, { id: 'fast', body: 'y' });

      const t0 = world.clock.now();
      await a.engine.connect();
      let visibleAt: number | null = null;
      for (let i = 0; i < 40; i += 1) {
        await world.runFor(5);
        const rows = await b.db.query(sql<{ body: string }>`
          SELECT body FROM notes WHERE id = 'fast' AND _deleted_at IS NULL
        `);
        if (rows[0]?.body === 'y') {
          visibleAt = world.clock.now();
          break;
        }
      }
      expect(visibleAt).not.toBeNull();
      expect((visibleAt ?? 0) - t0).toBeLessThan(PEER_VISIBLE_BUDGET_MS);

      world.release('bob', 'sync');
      await world.assertConverged();
    } finally {
      await world.dispose();
    }
  });
});
