import { describe, expect, test } from 'bun:test';
import { sqlJsPlaygroundDbFactory } from './playground-db-factory-sqljs';
import { shapeListQuery } from './playground-shapes';
import { createPlaygroundSim } from './playground-sim';

const dbFactory = sqlJsPlaygroundDbFactory();

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
          attributes: {
            'shape/kind': 'square',
            'shape/fill': '#33aa77',
            'shape/points': '10,10 90,10 90,90 10,90',
            'shape/order': 0,
          },
        },
      ]);
      await sim.syncNow(a.id);
      unsub();

      const br = await b.syncDb.read([q]);
      expect(br[0]?.entities.length).toBe(1);
      expect(br[0]?.entities[0]?.attributes['shape/fill']).toBe('#33aa77');

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
          attributes: {
            'shape/kind': 'circle',
            'shape/fill': '#ff0000',
            'shape/points': '50,50',
            'shape/order': 0,
          },
        },
      ]);
      await sim.syncNow(a.id);

      const srBefore = await sim.serverBacking.read([q]);
      expect(srBefore[0]?.entities.length).toBe(1);

      // --- Server goes down ---
      sim.partitionServer();
      expect(sim.isServerPartitioned()).toBe(true);

      // Client A writes locally while server is down
      const offlineShapeId = crypto.randomUUID();
      await a.syncDb.write([
        {
          entityId: offlineShapeId,
          entityType: 'shape',
          attributes: {
            'shape/kind': 'square',
            'shape/fill': '#00ff00',
            'shape/points': '10,10 90,10 90,90 10,90',
            'shape/order': 1,
          },
        },
      ]);

      // Push should fail silently (sync engine handles errors gracefully)
      await a.syncDb.runPushNow().catch(() => {});

      // Local write is still readable on client A
      const localA = await a.syncDb.read([q]);
      expect(localA[0]?.entities.length).toBe(2);

      // Server DB should NOT have the new shape
      const srDuring = await sim.serverBacking.read([q]);
      expect(srDuring[0]?.entities.length).toBe(1);

      // Client B cannot poll new data either
      await b.syncDb.runPollNow().catch(() => {});
      const localB = await b.syncDb.read([q]);
      expect(localB[0]?.entities.length).toBe(1);

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

      expect(finalServer[0]?.entities.length).toBe(2);
      expect(finalA[0]?.entities.length).toBe(2);
      expect(finalB[0]?.entities.length).toBe(2);

      const serverIds = new Set(
        finalServer[0]?.entities.map((e) => e.entityId)
      );
      expect(serverIds.has(shapeId)).toBe(true);
      expect(serverIds.has(offlineShapeId)).toBe(true);
    } finally {
      await sim.destroy();
    }
  });
});
