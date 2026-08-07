import { describe, expect, test } from 'bun:test';

import { RELIABLE_FAULTS } from '../../sim/faults';
import { expectLiveNote, readLiveNotes, setNote } from '../../sim/notes-app';
import { openSimWorld } from '../../sim/world';

describe('idempotent replay', () => {
  test('reconnect after offline set does not duplicate domain rows', async () => {
    const world = await openSimWorld({ seed: 70, faults: RELIABLE_FAULTS });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });

      a.lifecycle.setOnline(false);
      await a.mutate(setNote, { id: 'n1', body: 'once' });
      a.lifecycle.setOnline(true);
      await world.assertConverged();

      // Force another upload cycle via brief offline/online.
      a.lifecycle.setOnline(false);
      await world.runFor(20);
      a.lifecycle.setOnline(true);
      await world.assertConverged();

      await expectLiveNote(b.db, 'n1', { body: 'once' });
      const server = await readLiveNotes(world.server.db);
      expect(server.filter((r) => r.id === 'n1')).toHaveLength(1);
    } finally {
      await world.dispose();
    }
  });

  test('repeated setNote on same id keeps single live row', async () => {
    const world = await openSimWorld({ seed: 71, faults: RELIABLE_FAULTS });
    try {
      const a = await world.addClient({ id: 'alice' });
      await a.mutate(setNote, { id: 'n1', body: 'v1' });
      await a.mutate(setNote, { id: 'n1', body: 'v2' });
      await a.mutate(setNote, { id: 'n1', body: 'v3' });
      await world.assertConverged();
      const server = await readLiveNotes(world.server.db);
      expect(server.filter((r) => r.id === 'n1')).toHaveLength(1);
      await expectLiveNote(a.db, 'n1', { body: 'v3' });
    } finally {
      await world.dispose();
    }
  });
});
