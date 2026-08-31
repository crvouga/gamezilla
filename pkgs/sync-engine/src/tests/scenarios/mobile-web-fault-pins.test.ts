import { describe, expect, test } from 'bun:test';
import { openWorld } from '../../sim/world';
import { expectLiveNote, setNote } from '../apps/acme';
import { acmeSetNoteOp } from '../apps/acme/domain-model';
import { acmeDstApp } from '../apps/acme/dst-app';

describe('online lifecycle wakes query refetch', () => {
  test('online after offline triggers nudge path', async () => {
    await using world = await openWorld({ app: acmeDstApp, seed: 55001 });
    const a = world.clients.get('c0');
    expect(a).toBeDefined();
    if (a === undefined) return;
    a.online(false);
    await a.mutate(setNote, { id: 'n0', body: 'offline-local' });
    a.online(true);
    await world.runFor(100);
    await world.assertConverged();
    await expectLiveNote(world.server.db, 'n0', { body: 'offline-local' });
  });
});

describe('storage full merge abort', () => {
  test('quota arm aborts merge and queue survives restart', async () => {
    await using world = await openWorld({ app: acmeDstApp, seed: 55002 });
    const a = world.clients.get('c0');
    expect(a).toBeDefined();
    if (a === undefined) return;
    await world.playActions([
      {
        kind: 'armStoragePressure',
        clientId: 'c0',
        pressure: 'sqliteFull',
      },
    ]);
    const result = await a.mutate(setNote, { id: 'n2', body: 'queued' });
    expect(result.ok).toBe(true);
    await world.node('c0').restart();
    await world.assertConverged();
  });
});

describe('shared db peer engine', () => {
  test('two engines on one db converge', async () => {
    await using world = await openWorld({
      app: acmeDstApp,
      seed: 55003,
      knobs: {
        rowImageFanout: true,
        liveResendOnReconnect: false,
        bufferOutboundLive: false,
        clientCount: 2,
      },
    });
    await world.playActions([
      {
        kind: 'addPeerEngine',
        clientId: 'c2',
        shareWithClientId: 'c0',
      },
      acmeSetNoteOp('c0', 'n0', 'shared'),
      { kind: 'idle', ms: 30 },
      { kind: 'heal' },
    ]);
    await world.assertConverged();
  });
});

describe('fail next open', () => {
  test('restart survives failNextOpen arm', async () => {
    await using world = await openWorld({ app: acmeDstApp, seed: 55004 });
    await world.playActions([
      acmeSetNoteOp('c0', 'n0', 'before'),
      { kind: 'crash', clientId: 'c0' },
      { kind: 'failNextOpen', clientId: 'c0' },
      { kind: 'restart', clientId: 'c0' },
      { kind: 'restart', clientId: 'c0' },
      { kind: 'heal' },
    ]);
    await world.assertConverged();
  });
});

describe('prune server artifacts interleaved', () => {
  test('prune during session then mutate converges', async () => {
    await using world = await openWorld({ app: acmeDstApp, seed: 55005 });
    await world.playActions([
      acmeSetNoteOp('c0', 'n0', 'keep'),
      { kind: 'pruneServerArtifacts', olderThanMs: -2_000_000_000_000 },
      acmeSetNoteOp('c1', 'n1', 'after-prune'),
      { kind: 'heal' },
    ]);
    await world.assertConverged();
  });
});

describe('large snapshot hydrate', () => {
  test('~2k row catalog seed converges after heal', async () => {
    await using world = await openWorld({
      app: acmeDstApp,
      seed: 55006,
      sessionQuery: { name: 'notesLargeWorld', params: {} },
    });
    await world.playActions([
      {
        kind: 'server',
        name: 'seedLargeCatalogSilent',
        args: { count: 2_000 },
      },
      { kind: 'idle', ms: 100 },
      { kind: 'heal' },
    ]);
    await world.assertConverged();
  });
});
