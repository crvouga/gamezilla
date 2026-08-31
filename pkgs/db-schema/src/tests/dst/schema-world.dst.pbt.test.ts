import { describe, expect, test } from 'bun:test';
import { openDstWorld } from '@pkgs/dst';
import { assertDst, replayDst } from '@pkgs/dst/pbt';

import { requireServer, resolvePeer } from './peers';
import { schemaAt } from './schemas';
import { SCHEMA_DST, SCHEMA_SERVER_ID } from './system';

describe('db-schema DST world', () => {
  test('compatible schema chain + mixed clients + forbidden refuse', async () => {
    await assertDst(SCHEMA_DST, { maxCommands: 10, numRuns: 6 });
  }, 120_000);

  test('scripted: server ahead of lagging client stays valid', async () => {
    const { world } = await replayDst(SCHEMA_DST, {
      seed: 42,
      knobs: { clientCount: 2 },
      actions: [
        { kind: 'advance', target: SCHEMA_SERVER_ID, to: 2 },
        { kind: 'advance', target: 'client-0', to: 1 },
        { kind: 'advance', target: 'client-1', to: 2 },
      ],
    });
    try {
      expect(requireServer(world.system).version).toBe(2);
      // settle catches the lagging client up to the server version.
      expect(resolvePeer(world.system, 'client-0').version).toBe(2);
      expect(resolvePeer(world.system, 'client-1').version).toBe(2);
    } finally {
      await world.dispose();
    }
  }, 60_000);

  test('forbidden in-place type change is refused without plan drift', async () => {
    const { world } = await replayDst(SCHEMA_DST, {
      seed: 7,
      knobs: { clientCount: 1 },
      actions: [
        { kind: 'advance', target: SCHEMA_SERVER_ID, to: 1 },
        { kind: 'forbidden' },
      ],
    });
    try {
      expect(requireServer(world.system).planKinds).toEqual(['v1']);
    } finally {
      await world.dispose();
    }
  }, 60_000);

  test('nodes boot at v0 with server + client roles', async () => {
    await using world = await openDstWorld(SCHEMA_DST, {
      seed: 3,
      knobs: { clientCount: 3 },
    });
    expect(world.roleIds('server')).toEqual([SCHEMA_SERVER_ID]);
    expect(world.roleIds('client')).toEqual([
      'client-0',
      'client-1',
      'client-2',
    ]);
    expect(requireServer(world.system).version).toBe(0);
    expect(world.system.clients).toHaveLength(3);
  }, 60_000);

  test('surface coverage: schema snapshot exports checks/views/enums arrays', () => {
    const snap = schemaAt(4).snapshot();
    expect(Array.isArray(snap.checks)).toBe(true);
    expect(Array.isArray(snap.views)).toBe(true);
    expect(Array.isArray(snap.enums)).toBe(true);
    expect(Object.keys(snap.tables['items']!).includes('score')).toBe(true);
  });
});
