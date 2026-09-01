/**
 * Happy DOM coverage for in-process wipe channel + SqlOwner recovery.
 * Does not boot real wa-sqlite (no OPFS sync handles in Happy DOM).
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { wallTimers } from '@pkgs/clock';
import { sql } from '@pkgs/sql';
import { migrateToyKv } from '../../sim/toy-kv';
import { createSqlClientWebState } from '../../sim/types';
import {
  createSimOpfsSqlOwner,
  createSimOpfsStore,
  fillSimOpfsPool,
} from './owners/sim-opfs-sql-owner';
import {
  openSqlOwnerWithRecovery,
  PREPARE_WIPE_CHANNEL,
} from './recover-in-process';

beforeAll(() => {
  GlobalRegistrator.register({ url: 'http://127.0.0.1/' });
});

afterAll(() => {
  GlobalRegistrator.unregister();
});

describe('happy-dom sql-owner recovery', () => {
  test('BroadcastChannel prepare-wipe is deliverable', async () => {
    const seen: string[] = [];
    const channel = new BroadcastChannel(PREPARE_WIPE_CHANNEL);
    channel.onmessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; requestId?: string };
      if (data?.type === 'prepare-wipe' && typeof data.requestId === 'string') {
        seen.push(data.requestId);
      }
    };
    const sender = new BroadcastChannel(PREPARE_WIPE_CHANNEL);
    sender.postMessage({ type: 'prepare-wipe', requestId: 'wipe_1' });
    await new Promise<void>((resolve) => {
      wallTimers.setTimeout(() => resolve(), 20);
    });
    expect(seen).toContain('wipe_1');
    channel.close();
    sender.close();
  });

  test('sim pool exhaustion recovers without navigation', async () => {
    const hrefBefore = window.location.href;
    const store = createSimOpfsStore({ capacity: 6 });
    fillSimOpfsPool(store);
    const owner = createSimOpfsSqlOwner({ dbName: 'user_abcd1234ef01', store });
    const state = createSqlClientWebState();
    const client = await openSqlOwnerWithRecovery({
      owner,
      timers: wallTimers,
      notifyPeers: false,
      migrate: (c) => migrateToyKv(c, state),
    });
    await client.run(
      sql`INSERT INTO toy_kv (id, k, v) VALUES (${'a'}, ${'a'}, ${'1'})`
    );
    const rows = await client.query(
      sql<{ k: string; v: string }>`SELECT k, v FROM toy_kv`
    );
    expect(rows).toEqual([{ k: 'a', v: '1' }]);
    expect(window.location.href).toBe(hrefBefore);
    await owner.close();
    await owner.resetStore();
  });

  test('document can create and remove iframe element', () => {
    const frame = document.createElement('iframe');
    frame.setAttribute('title', 'sql-host-probe');
    document.body.appendChild(frame);
    expect(document.body.contains(frame)).toBe(true);
    frame.remove();
    expect(document.body.contains(frame)).toBe(false);
  });
});
