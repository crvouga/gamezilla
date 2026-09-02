import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/dst';
import { replay, runScenario } from '@pkgs/dst/pbt';

import type { SchemaPeer } from './peers';
import { schemaAt } from './schemas';
import { SCHEMA_SERVER_ID, SCHEMA_SYSTEM } from './system';

describe('db-schema framework world', () => {
  test('compatible schema chain + mixed clients + forbidden refuse', async () => {
    await runScenario(
      SCHEMA_SYSTEM as unknown as Parameters<typeof runScenario>[0],
      { maxCommands: 10, numRuns: 6 }
    );
  }, 120_000);

  test('scripted: server ahead of lagging client stays valid', async () => {
    const { world } = await replay(
      SCHEMA_SYSTEM as unknown as Parameters<typeof replay>[0],
      {
        seed: 42,
        knobs: { clientCount: 2 },
        commands: [
          { kind: 'advance', target: SCHEMA_SERVER_ID, to: 2 },
          { kind: 'advance', target: 'client-0', to: 1 },
          { kind: 'advance', target: 'client-1', to: 2 },
        ],
      }
    );
    try {
      expect((world.nodes['server'] as SchemaPeer).version).toBe(2);
      expect(
        (
          world.nodes['client'] as unknown as ReadonlyMap<string, SchemaPeer>
        ).get('client-0')!.version
      ).toBe(2);
      expect(
        (
          world.nodes['client'] as unknown as ReadonlyMap<string, SchemaPeer>
        ).get('client-1')!.version
      ).toBe(2);
    } finally {
      await world.dispose();
    }
  }, 60_000);

  test('forbidden in-place type change is refused without plan drift', async () => {
    const { world } = await replay(
      SCHEMA_SYSTEM as unknown as Parameters<typeof replay>[0],
      {
        seed: 7,
        knobs: { clientCount: 1 },
        commands: [
          { kind: 'advance', target: SCHEMA_SERVER_ID, to: 1 },
          { kind: 'forbidden' },
        ],
      }
    );
    try {
      expect((world.nodes['server'] as SchemaPeer).planKinds).toEqual(['v1']);
    } finally {
      await world.dispose();
    }
  }, 60_000);

  test('nodes boot at v0 with server + client roles', async () => {
    await using world = await openWorld(SCHEMA_SYSTEM, {
      seed: 3,
      knobs: { clientCount: 3 },
    });
    expect(world.nodeIds('server')).toEqual([SCHEMA_SERVER_ID]);
    expect(world.nodeIds('client')).toEqual([
      'client-0',
      'client-1',
      'client-2',
    ]);
    expect((world.nodes['server'] as SchemaPeer).version).toBe(0);
    expect(
      (world.nodes['client'] as unknown as ReadonlyMap<string, SchemaPeer>).size
    ).toBe(3);
  }, 60_000);

  test('surface coverage: schema snapshot exports checks/views/enums arrays', () => {
    const snap = schemaAt(4).snapshot();
    expect(Array.isArray(snap.checks)).toBe(true);
    expect(Array.isArray(snap.views)).toBe(true);
    expect(Array.isArray(snap.enums)).toBe(true);
    expect(Object.keys(snap.tables['items']!).includes('score')).toBe(true);
  });
});
