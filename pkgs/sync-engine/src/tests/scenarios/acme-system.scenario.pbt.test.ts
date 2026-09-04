import { describe, expect, test } from 'bun:test';

import type { SyncArgs } from '../../sim/scenario';
import {
  acmeSystem,
  armStoragePressure,
  expectConverged,
  pool,
  SYNC_STEP_MS,
} from '../apps/acme';

const STEP = SYNC_STEP_MS;

/** Boot acme for a repro pin; each `s.apply(pool.*)` mirrors one walk step. */
function pin(seed: number, args?: Partial<SyncArgs>) {
  return acmeSystem.script({ seed, ...(args !== undefined ? { args } : {}) });
}

describe('acme system PBT', () => {
  test(
    'explore draws args + walks the registered pool and converges',
    async () => {
      const report = await acmeSystem.explore({
        steps: 14,
        episodes: 8,
        seed: 42,
        stopOnViolation: true,
        time: { weight: 1, minMs: 0, maxMs: 40 },
      });
      expect(report.ok).toBe(true);
    },
    { timeout: 120_000 }
  );

  test('armCrash partition leaveSpace tamper still session-syncs', async () => {
    await using s = await pin(999992, { rowImageFanout: true });
    await s.apply(pool.armCrashAt, 'c1', 'afterNextMutationsPostAccepted');
    await s.elapse(STEP);
    await s.apply(pool.partition, 'c1', 'all');
    await s.elapse(STEP);
    await s.apply(pool.domain, {
      clientId: 'c1',
      mutation: 'leaveSpace',
      args: { spaceId: 's0' },
    });
    await s.elapse(STEP);
    await s.apply(pool.tamperLocalStorage, 'c1', 'corruptCheckpoint');
    await s.elapse(STEP);
    await s.apply(pool.domain, {
      clientId: 'c0',
      mutation: 'setNote',
      args: { id: 'n0', body: 'pbt', title: '' },
    });
    await s.elapse(STEP);
    await expectConverged(s);
  });

  test('serverCrash hold brokerRestart clearLocalData does not hang', async () => {
    await using s = await pin(11, {
      rowImageFanout: true,
      liveResendOnReconnect: true,
    });
    await s.apply(pool.domain, {
      clientId: 'c0',
      mutation: 'setFolder',
      args: { id: 'f0', title: 'cB7*B' },
    });
    await s.elapse(STEP);
    await s.apply(pool.serverCrash);
    await s.elapse(STEP);
    await s.apply(pool.hold, 'c0', 'all');
    await s.elapse(STEP);
    await s.apply(pool.brokerRestart);
    await s.elapse(STEP);
    await s.apply(pool.domain, {
      clientId: 'c1',
      mutation: 'setFolder',
      args: { id: 'f0', title: 'ir' },
    });
    await s.elapse(STEP);
    await s.apply(pool.serverCrash);
    await s.elapse(STEP);
    await s.apply(pool.clearLocalData, 'c0');
    await s.elapse(STEP);
    await s.apply(pool.domain, {
      clientId: 'c1',
      mutation: 'setNote',
      args: { id: 'n0', body: '7PH*6rhc', title: '' },
    });
    await s.elapse(STEP);
    await expectConverged(s);
  });

  test('serverCrash then corruptQueuedArgs of new note still converges', async () => {
    await using s = await pin(65161, {
      liveResendOnReconnect: true,
      bufferOutboundLive: true,
    });
    await s.apply(pool.serverCrash);
    await s.elapse(STEP);
    await s.apply(pool.domain, {
      clientId: 'c0',
      mutation: 'setNote',
      args: { id: 'n0', body: '', title: '' },
    });
    await s.elapse(STEP);
    await s.apply(pool.tamperLocalStorage, 'c0', 'corruptQueuedArgs');
    await s.elapse(STEP);
    await s.apply(pool.domain, {
      clientId: 'c0',
      mutation: 'setNote',
      args: { id: 'n2', body: 'pbt', title: '' },
    });
    await s.elapse(STEP);
    await expectConverged(s);
  });

  test('serverCrash then pending setNote drains after client crash', async () => {
    await using s = await pin(420184, { rowImageFanout: true });
    await s.apply(pool.serverCrash);
    await s.elapse(STEP);
    await s.apply(pool.domain, {
      clientId: 'c0',
      mutation: 'setNote',
      args: { id: 'n0', body: 'pbt', title: '' },
    });
    await s.elapse(STEP);
    await s.apply(pool.crash, 'c0');
    await s.elapse(STEP);
    await expectConverged(s);
  });

  test('serverCrash then restartWithSchema waits for HTTP again', async () => {
    await using s = await pin(1);
    await s.apply(pool.serverCrash);
    await s.elapse(STEP);
    await s.apply(pool.restartWithSchema, 'c0', 'baseline');
    await s.elapse(STEP);
    await s.apply(pool.publishFault, 1);
    await s.elapse(STEP);
    await expectConverged(s);
  });

  test('protocolCut then pending setFolder drains after settle', async () => {
    await using s = await pin(410988, {
      liveResendOnReconnect: true,
      bufferOutboundLive: true,
    });
    await s.apply(pool.protocolCut, 'c0');
    await s.elapse(STEP);
    await s.apply(pool.domain, {
      clientId: 'c0',
      mutation: 'setFolder',
      args: { id: 'f0', title: '' },
    });
    await s.elapse(STEP);
    await s.apply(pool.foreground, 'c0');
    await s.elapse(STEP);
    await expectConverged(s);
  });

  // FC_SEED=201419579 shrink: armCrashAt + protocolCut + mutate +
  // restartWithSchema must not hang waitForSessionSync on pending upload.
  test('armCrashAt protocolCut restartWithSchema still session-syncs', async () => {
    await using s = await pin(892161, { liveResendOnReconnect: true });
    await s.apply(pool.armCrashAt, 'c0', 'afterNextMutationsPostAccepted');
    await s.elapse(STEP);
    await s.apply(pool.protocolCut, 'c0');
    await s.elapse(STEP);
    await s.apply(pool.domain, {
      clientId: 'c0',
      mutation: 'createSpace',
      args: { id: 's0', title: '' },
    });
    await s.elapse(STEP);
    await s.apply(pool.restartWithSchema, 'c0', 'baseline');
    await s.elapse(STEP);
    await s.apply(pool.tamperLocalStorage, 'c0', 'corruptCheckpoint');
    await s.elapse(STEP);
    await expectConverged(s);
  });

  test('auth revoked then serverRestart skips closed-db seq checks', async () => {
    await using s = await pin(546326, {
      rowImageFanout: true,
      liveResendOnReconnect: true,
      clientCount: 3,
    });
    await s.apply(pool.auth, 'c0', 'revoked');
    await s.elapse(STEP);
    await s.apply(pool.serverRestart);
    await s.elapse(STEP);
    await expectConverged(s);
  });

  test('in-txn fail then auth revoke heals peer optimistic orphan', async () => {
    await using s = await pin(1037633887, { rowImageFanout: true });
    await s.apply(pool.armHttpFault, 'c1', {
      kind: 'failMutationsInsideTxnAfter',
      after: 0,
    });
    await s.elapse(STEP);
    await s.apply(pool.domain, {
      clientId: 'c1',
      mutation: 'setNote',
      args: { id: 'n0', body: 'pbt', title: '' },
    });
    await s.elapse(STEP);
    await s.apply(pool.auth, 'c1', 'revoked');
    await s.elapse(STEP);
    await s.apply(pool.serverRestart);
    await s.elapse(STEP);
    await expectConverged(s);
  });

  test('auth revoked then setNote then restartWithSchema opens fresh db', async () => {
    await using s = await pin(956276660, {
      liveResendOnReconnect: true,
      bufferOutboundLive: true,
    });
    await s.apply(pool.auth, 'c0', 'revoked');
    await s.elapse(STEP);
    await s.apply(pool.domain, {
      clientId: 'c1',
      mutation: 'setNote',
      args: { id: 'n0', body: 'pbt', title: '' },
    });
    await s.elapse(STEP);
    await s.apply(pool.restartWithSchema, 'c0', 'baseline');
    await s.elapse(STEP);
    await expectConverged(s);
  });

  test('server skew backwards then peer setNote still converges', async () => {
    await using s = await pin(6593, {
      liveResendOnReconnect: true,
      bufferOutboundLive: true,
    });
    await s.apply(pool.domain, {
      clientId: 'c1',
      mutation: 'setNote',
      args: { id: 'n2', body: 'b49', title: '' },
    });
    await s.elapse(STEP);
    await s.apply(pool.skew, 'server', -60_000);
    await s.elapse(STEP);
    await s.apply(pool.partition, 'c1', 'live');
    await s.elapse(STEP);
    await s.apply(pool.domain, {
      clientId: 'c0',
      mutation: 'setNote',
      args: { id: 'n2', body: 'b70', title: '' },
    });
    await s.elapse(STEP);
    await expectConverged(s);
  });

  test('server skew forward then silent insert still converges', async () => {
    await using s = await pin(3, { bufferOutboundLive: true });
    await s.apply(pool.skew, 'server', 60_000);
    await s.elapse(STEP);
    await s.apply(pool.domain, {
      clientId: 'c0',
      mutation: 'setFolder',
      args: { id: 'f0', title: '' },
    });
    await s.elapse(STEP);
    await s.apply(pool.server, {
      name: 'insertCatalogNoteSilent',
      args: { noteId: 'n0', body: '' },
    });
    await s.elapse(STEP);
    await s.apply(pool.protocolCut, 'c0');
    await s.elapse(STEP);
    await expectConverged(s);
  });

  // FC_SEED=14836507 counterexample [5230]: addPeerEngine then restart
  // donor must not close sqlite still held by the peer (settle closed-db).
  test('addPeerEngine then restart donor still session-syncs', async () => {
    await using s = await pin(5230);
    await s.apply(pool.domain, {
      clientId: 'c0',
      mutation: 'setNote',
      args: { id: 'n6', body: 'b947', title: '' },
    });
    await s.elapse(STEP);
    await s.apply(pool.server, {
      name: 'insertCatalogNoteSilent',
      args: { noteId: 'n4', body: 'c125' },
    });
    await s.elapse(STEP);
    await s.apply(pool.server, {
      name: 'insertCatalogNoteSilent',
      args: { noteId: 'n1', body: 'c658' },
    });
    await s.elapse(STEP);
    await s.apply(pool.addPeerEngine, 'c2', 'c0');
    await s.elapse(STEP);
    await s.apply(pool.restart, 'c0');
    await s.elapse(STEP);
    await s.apply(armStoragePressure, 'c1', { kind: 'sqliteFull', after: 2 });
    await s.elapse(STEP);
    await s.apply(pool.domain, {
      clientId: 'c0',
      mutation: 'deleteNote',
      args: { id: 'n5' },
    });
    await s.elapse(STEP);
    await s.apply(pool.domain, {
      clientId: 'c1',
      mutation: 'setFolder',
      args: { id: 'f3', title: 't70' },
    });
    await s.elapse(STEP);
    await expectConverged(s);
  });

  test(
    'same seed → identical walk choices',
    async () => {
      const choices = async (seed: number) => {
        await using s = await acmeSystem.script({
          seed,
          args: { clientCount: 2 },
        });
        const w = await s.walk({
          steps: 8,
          time: { weight: 1, minMs: 0, maxMs: 40 },
        });
        return JSON.stringify(w.choices);
      };
      for (const seed of [17, 4242, 9001]) {
        expect(await choices(seed)).toBe(await choices(seed));
      }
    },
    { timeout: 120_000 }
  );
});
