import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { playSyncActions, replaySyncPin } from '../../sim/system';
import { expectLiveNote, setNote } from '../apps/acme';
import { acmeSetNoteOp } from '../apps/acme/domain-model';
import { acmeLargeCatalogSystem, acmeSystem } from '../apps/acme/system';

describe('online lifecycle wakes query refetch', () => {
  test('online after offline triggers nudge path', async () => {
    await using world = await openWorld(acmeSystem, { seed: 55001 });
    const facade = world.facade;
    const a = facade.clients.get('c0');
    expect(a).toBeDefined();
    if (a === undefined) return;
    a.online(false);
    await a.mutate(setNote, { id: 'n0', body: 'offline-local' });
    a.online(true);
    await facade.runFor(100);
    await facade.assertConverged();
    await expectLiveNote(facade.server.db, 'n0', { body: 'offline-local' });
  });
});

describe('storage full merge abort', () => {
  test('quota arm aborts merge and queue survives restart', async () => {
    await using world = await openWorld(acmeSystem, { seed: 55002 });
    const facade = world.facade;
    const a = facade.clients.get('c0');
    expect(a).toBeDefined();
    if (a === undefined) return;
    await playSyncActions(world, [
      {
        kind: 'armStoragePressure',
        clientId: 'c0',
        pressure: 'sqliteFull',
      },
    ]);
    const result = await a.mutate(setNote, { id: 'n2', body: 'queued' });
    expect(result.ok).toBe(true);
    await facade.node('c0').restart();
    await facade.assertConverged();
  });
});

describe('shared db peer engine', () => {
  test('two engines on one db converge', async () => {
    await replaySyncPin(acmeSystem, {
      seed: 55003,
      knobs: {
        rowImageFanout: true,
        liveResendOnReconnect: false,
        bufferOutboundLive: false,
        clientCount: 2,
      },
      actions: [
        {
          kind: 'addPeerEngine',
          clientId: 'c2',
          shareWithClientId: 'c0',
        },
        acmeSetNoteOp('c0', 'n0', 'shared'),
        { kind: 'idle', ms: 30 },
        { kind: 'heal' },
      ],
    });
  });

  // runAcmeSeed 5230: restart donor must not close sqlite still held by c2.
  test('restart donor after addPeerEngine still converges', async () => {
    await replaySyncPin(acmeSystem, {
      seed: 5230,
      actions: [
        acmeSetNoteOp('c0', 'n6', 'b947'),
        {
          kind: 'addPeerEngine',
          clientId: 'c2',
          shareWithClientId: 'c0',
        },
        { kind: 'restart', clientId: 'c0' },
      ],
    });
  });
});

describe('fail next open', () => {
  test('restart survives failNextOpen arm', async () => {
    await replaySyncPin(acmeSystem, {
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
});

describe('prune server artifacts interleaved', () => {
  test('prune during session then mutate converges', async () => {
    await replaySyncPin(acmeSystem, {
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
    await replaySyncPin(acmeLargeCatalogSystem, {
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
