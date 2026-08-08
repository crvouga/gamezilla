import { describe, expect, test } from 'bun:test';
import {
  expectLiveNote,
  notesDomainPack,
  setNote,
} from '../../domain-packs/notes-app';
import { RELIABLE_FAULTS } from '../../sim/faults';
import { openSimWorld } from '../../sim/world';

describe('held sync upload retries on release', () => {
  test('held sync keeps queue pending then confirms after release', async () => {
    await using world = await openSimWorld({
      domain: notesDomainPack,
      seed: 502,
      faults: RELIABLE_FAULTS,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    let mutationId = '';
    {
      using _hold = world.net('alice', 'sync').set('hold');
      const queued = await a.mutate(setNote, {
        id: 'n1',
        body: 'transient',
      });
      expect(queued.ok).toBe(true);
      if (!queued.ok) return;
      mutationId = queued.mutationId;

      await world.runFor(200);
      await expect(
        world.until(a.outcome(mutationId), { budgetMs: 100 })
      ).rejects.toThrow(/until timed out/);
    }
    await world.until(a.outcome(mutationId), { budgetMs: 5_000 });
    expect(await a.outcome(mutationId)).toBe('confirmed');
    await world.assertConverged();
    await expectLiveNote(b.db, 'n1', { body: 'transient' });
  });
});
