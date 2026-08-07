import { describe, expect, test } from 'bun:test';

import { RELIABLE_FAULTS } from '../../sim/faults';
import {
  deleteNote,
  expectNoteNotLive,
  readNoteTombstone,
  setNote,
} from '../../sim/notes-app';
import { openSimWorld, SIM_SERVER_NODE_ID } from '../../sim/world';

describe('created at pinning', () => {
  test('replay pins env.now to mutation createdAt under client clock skew', async () => {
    const world = await openSimWorld({ seed: 720, faults: RELIABLE_FAULTS });
    try {
      world.setClockSkew('alice', -60_000);
      world.setClockSkew('bob', 0);
      world.setClockSkew(SIM_SERVER_NODE_ID, 60_000);

      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });

      await a.mutate(setNote, { id: 'n1', body: 'live' });
      await world.assertConverged();

      await a.engine.disconnect();
      const skewedNow = world.nowFor('alice');
      const del = await a.mutate(deleteNote, { id: 'n1' });
      expect(del.ok).toBe(true);
      const expectedIso = new Date(skewedNow).toISOString();

      await a.engine.connect();
      a.engine.wakeUploads();
      await world.assertConverged();

      await expectNoteNotLive(a.db, 'n1');
      await expectNoteNotLive(b.db, 'n1');
      await expectNoteNotLive(world.server.db, 'n1');

      expect(await readNoteTombstone(world.server.db, 'n1')).toBe(expectedIso);
      expect(await readNoteTombstone(b.db, 'n1')).toBe(expectedIso);
      expect(await readNoteTombstone(a.db, 'n1')).toBe(expectedIso);
    } finally {
      await world.dispose();
    }
  });
});
