import { describe, expect, test } from 'bun:test';
import { shapeListQuery } from './playground-shapes';
import { createPlaygroundSim } from './playground-sim';

describe('playground sim (sql.js)', () => {
  test('two clients sync a shape through manual push/poll', async () => {
    const sim = await createPlaygroundSim({ clientCount: 2 });
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
});
