import { describe, expect, test } from 'bun:test';
import { type PatchDbResult, toAttributeState } from '../interface';
import { sqlJsPlaygroundDbFactory } from './playground-db-factory-sqljs';
import { shapeListQuery, SHAPE_ATTR } from './playground-shapes';
import { createPlaygroundSim } from './playground-sim';

const dbFactory = sqlJsPlaygroundDbFactory();

function entityCount(results: PatchDbResult[]): number {
  const first = results[0];
  return first ? first.entities.length : 0;
}

function entityIds(results: PatchDbResult[]): Set<string> {
  const first = results[0];
  return new Set((first?.entities ?? []).map((e) => e.entityId));
}

describe('playground sim (sql.js)', () => {
  test('two clients sync a shape through manual push/poll', async () => {
    const sim = await createPlaygroundSim({ clientCount: 2, dbFactory });
    try {
      const a = sim.clients[0];
      const b = sim.clients[1];
      expect(a).toBeDefined();
      expect(b).toBeDefined();
      if (!a || !b) return;

      const q = shapeListQuery();
      const unsub = b.syncDb.subscribe.entities(q, () => {});

      await a.syncDb.write([
        {
          entityId: crypto.randomUUID(),
          entityType: 'shape',
          attributes: toAttributeState({
            'shape/kind': 'square',
            'shape/fill': '#33aa77',
            'shape/points': '10,10 90,10 90,90 10,90',
            'shape/order': 0,
          }),
        },
      ]);
      await sim.syncNow(a.id);
      unsub();

      const br = await b.syncDb.read([q]);
      expect(br[0]?.entities.length).toBe(1);
      expect(br[0]?.entities[0]?.attributes[SHAPE_ATTR.fill]).toBe('#33aa77');

      const sr = await sim.serverBacking.read([q]);
      expect(sr[0]?.entities.length).toBe(1);
    } finally {
      await sim.destroy();
    }
  });

  test('clients tolerate server partition and converge after heal', async () => {
    const sim = await createPlaygroundSim({ clientCount: 2, dbFactory });
    try {
      const a = sim.clients[0];
      const b = sim.clients[1];
      expect(a).toBeDefined();
      expect(b).toBeDefined();
      if (!a || !b) return;

      const q = shapeListQuery();
      const unsubA = a.syncDb.subscribe.entities(q, () => {});
      const unsubB = b.syncDb.subscribe.entities(q, () => {});

      const shapeId = crypto.randomUUID();
      await a.syncDb.write([
        {
          entityId: shapeId,
          entityType: 'shape',
          attributes: toAttributeState({
            'shape/kind': 'circle',
            'shape/fill': '#ff0000',
            'shape/points': '50,50',
            'shape/order': 0,
          }),
        },
      ]);
      await sim.syncNow(a.id);

      const srBefore = await sim.serverBacking.read([q]);
      expect(entityCount(srBefore)).toBe(1);

      // --- Server goes down ---
      sim.partitionServer();
      expect(sim.isServerPartitioned()).toBe(true);

      // Client A writes locally while server is down
      const offlineShapeId = crypto.randomUUID();
      await a.syncDb.write([
        {
          entityId: offlineShapeId,
          entityType: 'shape',
          attributes: toAttributeState({
            'shape/kind': 'square',
            'shape/fill': '#00ff00',
            'shape/points': '10,10 90,10 90,90 10,90',
            'shape/order': 1,
          }),
        },
      ]);

      // Push should fail silently (sync engine handles errors gracefully)
      await a.syncDb.runPushNow().catch(() => {});

      // Local write is still readable on client A
      const localA = await a.syncDb.read([q]);
      expect(entityCount(localA)).toBe(2);

      // Server DB should NOT have the new shape
      const srDuring = await sim.serverBacking.read([q]);
      expect(entityCount(srDuring)).toBe(1);

      // Client B cannot poll new data either
      await b.syncDb.runPollNow().catch(() => {});
      const localB = await b.syncDb.read([q]);
      expect(entityCount(localB)).toBe(1);

      // --- Server comes back ---
      sim.healServer();
      expect(sim.isServerPartitioned()).toBe(false);

      // Now sync converges: push A's offline write, then poll both
      await sim.syncNow(a.id);

      unsubA();
      unsubB();

      // All three nodes should agree
      const finalServer = await sim.serverBacking.read([q]);
      const finalA = await a.syncDb.read([q]);
      const finalB = await b.syncDb.read([q]);

      expect(entityCount(finalServer)).toBe(2);
      expect(entityCount(finalA)).toBe(2);
      expect(entityCount(finalB)).toBe(2);

      const serverIds = entityIds(finalServer);
      expect(serverIds.has(shapeId)).toBe(true);
      expect(serverIds.has(offlineShapeId)).toBe(true);
    } finally {
      await sim.destroy();
    }
  });
});
