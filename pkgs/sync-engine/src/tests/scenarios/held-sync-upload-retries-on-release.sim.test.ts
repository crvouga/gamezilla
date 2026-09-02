import { describe, expect, test } from 'bun:test';
import { expectLiveNote, setNote } from '../apps/acme';
import { openAcmeWorld } from '../apps/acme/system';

describe('held sync upload retries on release', () => {
  test('held sync keeps queue pending then confirms after release', async () => {
    await using world = await openAcmeWorld({
      seed: 502,
      knobs: {
        clientCount: 0,
      },
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

      await world.waitNever(a.outcome(mutationId), { forMs: 300 });
    }
    await world.waitUntil(a.outcome(mutationId), { withinMs: 5_000 });
    expect(await a.outcome(mutationId)).toBe('confirmed');
    await world.assertConverged();
    await expectLiveNote(b.db, 'n1', { body: 'transient' });
  });
});
