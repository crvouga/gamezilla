import { describe, expect, test } from 'bun:test';

import { RELIABLE_FAULTS } from '../../sim/faults';
import {
  expectLiveNote,
  illegalHardDeleteNote,
  readLiveNotes,
  setNote,
} from '../../sim/notes-app';
import { openSimWorld } from '../../sim/world';

describe('domain hard delete rejected', () => {
  test('illegalHardDeleteNote fails with NO_HARD_DELETE; row stays live', async () => {
    const world = await openSimWorld({ seed: 60, faults: RELIABLE_FAULTS });
    try {
      const a = await world.addClient({ id: 'alice' });
      await a.mutate(setNote, { id: 'n1', body: 'keep-me' });
      await world.assertConverged();

      const result = await a.mutate(illegalHardDeleteNote, { id: 'n1' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failures.some((f) => f.code === 'NO_HARD_DELETE')).toBe(
          true
        );
      }

      await expectLiveNote(a.db, 'n1', { body: 'keep-me' });
      const server = await readLiveNotes(world.server.db);
      expect(server.find((r) => r.id === 'n1')?.body).toBe('keep-me');
    } finally {
      await world.dispose();
    }
  });
});
