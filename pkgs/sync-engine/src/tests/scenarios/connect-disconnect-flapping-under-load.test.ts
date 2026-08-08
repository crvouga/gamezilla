import { describe, expect, test } from 'bun:test';

import { RELIABLE_FAULTS } from '../../sim/faults';
import { expectLiveNote, readLiveNotes, setNote } from '../../sim/notes-app';
import { openSimWorld } from '../../sim/world';

describe('connect disconnect flapping under load', () => {
  test('online/foreground flap under mutation storm still converges', async () => {
    const world = await openSimWorld({ seed: 1050, faults: RELIABLE_FAULTS });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });

      for (let i = 0; i < 24; i += 1) {
        await a.mutate(setNote, {
          id: `n-${String(i).padStart(2, '0')}`,
          body: `b${i}`,
        });
        if (i % 4 === 0) {
          b.lifecycle.setOnline(false);
          await world.runFor(25);
          b.lifecycle.setOnline(true);
        }
        if (i % 5 === 0) {
          a.lifecycle.setForeground(false);
          b.lifecycle.setForeground(false);
          await world.runFor(25);
          a.lifecycle.setForeground(true);
          b.lifecycle.setForeground(true);
        }
        if (i % 6 === 0) {
          a.lifecycle.setOnline(false);
          await world.runFor(25);
          a.lifecycle.setOnline(true);
          a.engine.wakeUploads();
        }
      }

      a.lifecycle.setOnline(true);
      a.lifecycle.setForeground(true);
      b.lifecycle.setOnline(true);
      b.lifecycle.setForeground(true);
      a.engine.wakeUploads();
      await world.assertConverged();
      expect((await readLiveNotes(world.server.db)).length).toBe(24);
      await expectLiveNote(b.db, 'n-00', { body: 'b0' });
      await expectLiveNote(b.db, 'n-23', { body: 'b23' });
    } finally {
      await world.dispose();
    }
  });

  test('seed sweep flap + mutate converges', async () => {
    for (const seed of [1051, 1052, 1053] as const) {
      const world = await openSimWorld({ seed, faults: RELIABLE_FAULTS });
      try {
        const a = await world.addClient({ id: 'alice' });
        const b = await world.addClient({ id: 'bob' });
        for (let i = 0; i < 8; i += 1) {
          await a.mutate(setNote, { id: `n-${seed}-${i}`, body: `x${i}` });
          b.lifecycle.setOnline(i % 2 === 0);
          await world.runFor(10);
          b.lifecycle.setOnline(true);
        }
        await world.assertConverged();
        await expectLiveNote(b.db, `n-${seed}-7`, { body: 'x7' });
      } finally {
        await world.dispose();
      }
    }
  });
});
