import { describe, expect, test } from 'bun:test';

import { RELIABLE_FAULTS } from '../../sim/faults';
import {
  expectLiveNote,
  expectNoteNotLive,
  setNote,
} from '../../sim/notes-app';
import { openSimWorld, type SimWorld } from '../../sim/world';

async function pump(
  world: SimWorld,
  work: Promise<unknown>,
  maxVirtualMs = 2_000
): Promise<void> {
  let done = false;
  const tracked = Promise.resolve(work).finally(() => {
    done = true;
  });
  const steps = Math.ceil(maxVirtualMs / 25);
  for (let i = 0; i < steps && !done; i += 1) {
    await world.runFor(25);
  }
  await tracked;
}

describe('background foreground', () => {
  test('background pauses query sweeps until foreground', async () => {
    const world = await openSimWorld({
      seed: 507,
      faults: RELIABLE_FAULTS,
      rowImageFanout: false,
    });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });
      await a.mutate(setNote, { id: 'warm', body: 'w' });
      await world.assertConverged();

      b.lifecycle.setForeground(false);
      await a.mutate(setNote, { id: 'n1', body: 'while-bg' });
      await world.runFor(300);
      await expectNoteNotLive(b.db, 'n1');

      b.lifecycle.setForeground(true);
      await pump(world, b.engine.refreshQueries());
      await world.assertConverged();
      await expectLiveNote(b.db, 'n1', { body: 'while-bg' });
    } finally {
      await world.dispose();
    }
  });

  test('background does not block local mutate visibility', async () => {
    const world = await openSimWorld({ seed: 508, faults: RELIABLE_FAULTS });
    try {
      const a = await world.addClient({ id: 'alice' });
      a.lifecycle.setForeground(false);
      const ok = await a.mutate(setNote, { id: 'local', body: 'bg-write' });
      expect(ok.ok).toBe(true);
      await expectLiveNote(a.db, 'local', { body: 'bg-write' });
      // Drain upload while pumping sim time (dispose awaits upload stop).
      a.lifecycle.setForeground(true);
      await world.runFor(200);
    } finally {
      await world.dispose();
    }
  });
});
