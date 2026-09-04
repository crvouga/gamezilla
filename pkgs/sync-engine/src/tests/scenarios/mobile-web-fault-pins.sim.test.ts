import { describe, test } from 'bun:test';
import {
  ACME_LARGE_CATALOG_ARGS,
  acmeSystem,
  armStoragePressure,
  expectConverged,
  mutate,
  online,
  playAcmePin,
  restart,
  setNote,
} from '../apps/acme';
import { acmeSetNoteOp } from '../apps/acme/domain-model';
import { expectLiveNoteAt } from '../apps/acme/reads';

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
    await playAcmePin({
      seed: 55003,
      args: {
        rowImageFanout: true,
        liveResendOnReconnect: false,
        bufferOutboundLive: false,
        clientCount: 2,
      },
      actions: [
        { kind: 'addPeerEngine', clientId: 'c2', shareWithClientId: 'c0' },
        acmeSetNoteOp('c0', 'n0', 'shared'),
        { kind: 'idle', ms: 30 },
        { kind: 'heal' },
      ],
    });
  });

  // runAcmeSeed 5230: restart donor must not close sqlite still held by c2.
  test('restart donor after addPeerEngine still converges', async () => {
    await playAcmePin({
      seed: 5230,
      actions: [
        acmeSetNoteOp('c0', 'n6', 'b947'),
        { kind: 'addPeerEngine', clientId: 'c2', shareWithClientId: 'c0' },
        { kind: 'restart', clientId: 'c0' },
      ],
    });
  });
});

describe('fail next open', () => {
  test('restart survives failNextOpen arm', async () => {
    await playAcmePin({
      seed: 55004,
      actions: [
        acmeSetNoteOp('c0', 'n0', 'before'),
        { kind: 'crash', clientId: 'c0' },
        { kind: 'failNextOpen', clientId: 'c0' },
        { kind: 'restart', clientId: 'c0' },
        { kind: 'restart', clientId: 'c0' },
        { kind: 'heal' },
      ],
    });
  });

  // Shrunk: failNextOpen then restartWithSchema must not leak
  // `sim: fail next open`.
  test('restartWithSchema survives failNextOpen arm', async () => {
    await playAcmePin({
      seed: 55007,
      args: {
        rowImageFanout: false,
        liveResendOnReconnect: true,
        bufferOutboundLive: true,
        clientCount: 3,
      },
      actions: [
        { kind: 'failNextOpen', clientId: 'c0' },
        { kind: 'restartWithSchema', clientId: 'c0', variant: 'baseline' },
        {
          kind: 'subscribe',
          clientId: 'c0',
          queryName: 'notesAll',
          params: {},
        },
      ],
    });
  });
});

describe('prune server artifacts interleaved', () => {
  test('prune during session then mutate converges', async () => {
    await playAcmePin({
      seed: 55005,
      actions: [
        acmeSetNoteOp('c0', 'n0', 'keep'),
        { kind: 'pruneServerArtifacts', olderThanMs: -2_000_000_000_000 },
        acmeSetNoteOp('c1', 'n1', 'after-prune'),
        { kind: 'heal' },
      ],
    });
  });
});

describe('large snapshot hydrate', () => {
  test('~2k row catalog seed converges after heal', async () => {
    await playAcmePin({
      args: ACME_LARGE_CATALOG_ARGS,
      seed: 55006,
      actions: [
        {
          kind: 'server',
          name: 'seedLargeCatalogSilent',
          args: { count: 2_000 },
        },
        { kind: 'idle', ms: 100 },
        { kind: 'heal' },
      ],
    });
  });
});
