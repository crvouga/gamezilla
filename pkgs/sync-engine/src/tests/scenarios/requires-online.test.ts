import { describe, expect, test } from 'bun:test';

import { RELIABLE_FAULTS } from '../../sim/faults';
import { mutationStatus } from '../../sim/mutation-status';
import { expectLiveNote, requiresOnlineNote } from '../../sim/notes-app';
import { openSimWorld } from '../../sim/world';

describe('requires online', () => {
  test('offline mutate fails with OFFLINE and does not queue', async () => {
    const world = await openSimWorld({ seed: 510, faults: RELIABLE_FAULTS });
    try {
      const a = await world.addClient({ id: 'alice' });
      a.lifecycle.setOnline(false);

      const denied = await a.mutate(requiresOnlineNote, {
        id: 'n1',
        body: 'need-net',
      });
      expect(denied.ok).toBe(false);
      if (!denied.ok) {
        expect(denied.failures.some((f) => f.code === 'OFFLINE')).toBe(true);
      }

      a.lifecycle.setOnline(true);
      const ok = await a.mutate(requiresOnlineNote, {
        id: 'n1',
        body: 'online-ok',
      });
      expect(ok.ok).toBe(true);
      if (!ok.ok) return;

      for (let i = 0; i < 40; i += 1) {
        if ((await mutationStatus(a.db, ok.mutationId)) === 'confirmed') break;
        await world.runFor(50);
      }
      expect(await mutationStatus(a.db, ok.mutationId)).toBe('confirmed');
      await world.assertConverged();
      await expectLiveNote(a.db, 'n1', { body: 'online-ok' });
    } finally {
      await world.dispose();
    }
  });
});
