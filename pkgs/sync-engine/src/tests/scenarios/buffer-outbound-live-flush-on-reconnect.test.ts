import { describe, expect, test } from 'bun:test';
import { sql } from '@pkgs/sql';
import {
  expectLiveNote,
  expectNoteNotLive,
  notesDomainPack,
  setNote,
} from '../../domain-packs/notes-app';
import { openSimWorld } from '../../sim/world';

const PEER_VISIBLE_BUDGET_MS = 200;

describe('buffer outbound live flush on reconnect', () => {
  test('default: no outbound buffer; peers wait for upload/sync', async () => {
    await using world = await openSimWorld({
      domain: notesDomainPack,
      seed: 701,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await a.mutate(setNote, { id: 'warm', body: 'w' });
    await world.assertConverged();

    await a.disconnect();
    {
      using _hold = world.net('alice', 'sync').set('hold');
      await a.mutate(setNote, { id: 'n1', body: 'while-down' });
      await a.connect();
      await world.runFor(200);
      await expectNoteNotLive(b.db, 'n1');
    }
    await world.assertConverged();
    await expectLiveNote(b.db, 'n1', { body: 'while-down' });
  });

  test('bufferOutboundLive: peer sees note while publisher sync held', async () => {
    await using world = await openSimWorld({
      domain: notesDomainPack,
      seed: 702,
      bufferOutboundLive: true,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await a.mutate(setNote, { id: 'warm', body: 'w' });
    await world.assertConverged();

    await a.disconnect();
    {
      using _hold = world.net('alice', 'sync').set('hold');
      await a.mutate(setNote, { id: 'n1', body: 'buffered' });
      await a.connect();
      await world.runFor(200);
      await expectLiveNote(b.db, 'n1', { body: 'buffered' });
    }
    await world.assertConverged();
    await expectLiveNote(b.db, 'n1', { body: 'buffered' });
  });

  test('bufferOutboundLive: peer visible under latency budget via live', async () => {
    await using world = await openSimWorld({
      domain: notesDomainPack,
      seed: 703,
      bufferOutboundLive: true,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await a.mutate(setNote, { id: 'warm', body: 'w' });
    await world.assertConverged();

    await a.disconnect();
    {
      using _hold = world.net('bob', 'sync').set('hold');
      await a.mutate(setNote, { id: 'fast', body: 'y' });
      const t0 = world.node('bob').now();
      await a.connect();
      const at = await world.until(
        async () => {
          const rows = await b.db.query(sql<{ body: string }>`
            SELECT body FROM notes WHERE id = 'fast' AND _deleted_at IS NULL
          `);
          return rows[0]?.body === 'y';
        },
        { budgetMs: 400, stepMs: 5 }
      );
      expect(at - t0).toBeLessThan(PEER_VISIBLE_BUDGET_MS);
    }
    await world.assertConverged();
  });
});
