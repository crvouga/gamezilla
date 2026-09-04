import { describe, test } from 'bun:test';
import {
  ACME_LARGE_CATALOG_ARGS,
  acmeSystem,
  armStoragePressure,
  expectConverged,
  mutate,
  online,
  pool,
  restart,
  SYNC_STEP_MS,
  serverPrune,
  setNote,
} from '../apps/acme';
import { expectLiveNoteAt } from '../apps/acme/reads';

const STEP = SYNC_STEP_MS;
const note = (clientId: string, id: string, body: string) =>
  ({ clientId, mutation: 'setNote', args: { id, body, title: '' } }) as const;

describe('online lifecycle wakes query refetch', () => {
  test('online after offline triggers nudge path', async () => {
    await using s = await acmeSystem.script({
      seed: 55001,
    });

    await s.apply(online, 'c0', false);
    await s.apply(mutate, 'c0', setNote, {
      id: 'n0',
      body: 'offline-local',
    });
    await s.apply(online, 'c0', true);
    await s.elapse(100);
    await expectConverged(s);
    await expectLiveNoteAt(s, 'server', 'n0', { body: 'offline-local' });
  });
});

describe('storage full merge abort', () => {
  test('quota arm aborts merge and queue survives restart', async () => {
    await using s = await acmeSystem.script({
      seed: 55002,
    });

    await s.apply(armStoragePressure, 'c0', 'sqliteFull');
    await s.apply(mutate, 'c0', setNote, { id: 'n2', body: 'queued' });
    await s.apply(restart, 'c0', {});
    await expectConverged(s);
  });
});

describe('shared db peer engine', () => {
  test('two engines on one db converge', async () => {
    await using s = await acmeSystem.script({
      seed: 55003,
      args: {
        rowImageFanout: true,
        liveResendOnReconnect: false,
        bufferOutboundLive: false,
        clientCount: 2,
      },
    });
    await s.apply(pool.addPeerEngine, 'c2', 'c0');
    await s.elapse(STEP);
    await s.apply(pool.domain, note('c0', 'n0', 'shared'));
    await s.elapse(30);
    await s.apply(pool.heal);
    await expectConverged(s);
  });

  // Seed 5230: restart donor must not close sqlite still held by c2.
  test('restart donor after addPeerEngine still converges', async () => {
    await using s = await acmeSystem.script({ seed: 5230 });
    await s.apply(pool.domain, note('c0', 'n6', 'b947'));
    await s.elapse(STEP);
    await s.apply(pool.addPeerEngine, 'c2', 'c0');
    await s.elapse(STEP);
    await s.apply(pool.restart, 'c0');
    await s.elapse(STEP);
    await expectConverged(s);
  });
});

describe('fail next open', () => {
  test('restart survives failNextOpen arm', async () => {
    await using s = await acmeSystem.script({ seed: 55004 });
    await s.apply(pool.domain, note('c0', 'n0', 'before'));
    await s.elapse(STEP);
    await s.apply(pool.crash, 'c0');
    await s.elapse(STEP);
    await s.apply(pool.failNextOpen, 'c0');
    await s.elapse(STEP);
    await s.apply(pool.restart, 'c0');
    await s.elapse(STEP);
    await s.apply(pool.restart, 'c0');
    await s.elapse(STEP);
    await s.apply(pool.heal);
    await expectConverged(s);
  });

  // Shrunk: failNextOpen then restartWithSchema must not leak
  // `sim: fail next open`.
  test('restartWithSchema survives failNextOpen arm', async () => {
    await using s = await acmeSystem.script({
      seed: 55007,
      args: {
        rowImageFanout: false,
        liveResendOnReconnect: true,
        bufferOutboundLive: true,
        clientCount: 3,
      },
    });
    await s.apply(pool.failNextOpen, 'c0');
    await s.elapse(STEP);
    await s.apply(pool.restartWithSchema, 'c0', 'baseline');
    await s.elapse(STEP);
    await s.apply(pool.subscribe, 'c0');
    await s.elapse(STEP);
    await expectConverged(s);
  });
});

describe('prune server artifacts interleaved', () => {
  test('prune during session then mutate converges', async () => {
    await using s = await acmeSystem.script({ seed: 55005 });
    await s.apply(pool.domain, note('c0', 'n0', 'keep'));
    await s.elapse(STEP);
    await s.apply(serverPrune, -2_000_000_000_000);
    await s.elapse(STEP);
    await s.apply(pool.domain, note('c1', 'n1', 'after-prune'));
    await s.elapse(STEP);
    await s.apply(pool.heal);
    await expectConverged(s);
  });
});

describe('large snapshot hydrate', () => {
  test('~2k row catalog seed converges after heal', async () => {
    await using s = await acmeSystem.script({
      seed: 55006,
      args: ACME_LARGE_CATALOG_ARGS,
    });
    await s.apply(pool.server, {
      name: 'seedLargeCatalogSilent',
      args: { count: 2_000 },
    });
    await s.elapse(100);
    await s.apply(pool.heal);
    await expectConverged(s);
  });
});
