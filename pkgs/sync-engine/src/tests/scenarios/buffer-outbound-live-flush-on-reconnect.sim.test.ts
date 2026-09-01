import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { sql } from '@pkgs/sql';
import { syncFacade } from '../../sim/system';
import { expectLiveNote, expectNoteNotLive, setNote } from '../apps/acme';
import { acmeSystem } from '../apps/acme/system';

const PEER_VISIBLE_BUDGET_MS = 200;

describe('buffer outbound live flush on reconnect', () => {
  test('default: no outbound buffer; peers wait for upload/sync', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 701,
      knobs: {
        clientCount: 0,
      },
    });
    const world = syncFacade(host.system);
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
    await using host = await openWorld(acmeSystem, {
      seed: 702,
      knobs: {
        clientCount: 0,
        bufferOutboundLive: true,
      },
    });
    const world = syncFacade(host.system);
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
    await using host = await openWorld(acmeSystem, {
      seed: 703,
      knobs: {
        clientCount: 0,
        bufferOutboundLive: true,
      },
    });
    const world = syncFacade(host.system);
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
            SELECT body FROM notes WHERE id = 'fast' AND deleted_at IS NULL
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
