import { describe, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeDraws,
  acmeLargeCatalogSystem,
  acmeSystem,
  armStoragePressure,
  assertConverged,
  converge,
  mutate,
  online,
  passTime,
  playAcmePin,
  restart,
  setNote,
  syncVirtualHost,
} from '../apps/acme';
import { acmeSetNoteOp } from '../apps/acme/domain-model';
import { expectLiveNoteAt } from '../apps/acme/reads';

describe('online lifecycle wakes query refetch', () => {
  test('online after offline triggers nudge path', async () => {
    await using run = await start(acmeSystem, {
      seed: 55001,
      host: syncVirtualHost(),
      draws: acmeDraws(),
      properties: [],
    });

    await run.apply(online, 'c0', false);
    await run.apply(mutate, 'c0', setNote, {
      id: 'n0',
      body: 'offline-local',
    });
    await run.apply(online, 'c0', true);
    await run.apply(passTime, 100);
    await run.apply(assertConverged);
    await expectLiveNoteAt(run, 'server', 'n0', { body: 'offline-local' });
  });
});

describe('storage full merge abort', () => {
  test('quota arm aborts merge and queue survives restart', async () => {
    await using run = await start(acmeSystem, {
      seed: 55002,
      host: syncVirtualHost(),
      draws: acmeDraws(),
      properties: [],
    });

    await run.apply(armStoragePressure, 'c0', 'sqliteFull');
    await run.apply(mutate, 'c0', setNote, { id: 'n2', body: 'queued' });
    await run.apply(restart, 'c0', {});
    await run.apply(converge);
  });
});

describe('shared db peer engine', () => {
  test('two engines on one db converge', async () => {
    await playAcmePin({
      seed: 55003,
      knobs: {
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
      knobs: {
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
      system: acmeLargeCatalogSystem,
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
