import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  expectConverged,
  hold,
  lastMutationId,
  lastMutationOk,
  liveNote,
  mutate,
  neverAcme,
  outcome,
  release,
  setNote,
  untilAcme,
} from '../apps/acme';

describe('held sync upload retries on release', () => {
  test('held sync keeps queue pending then confirms after release', async () => {
    await using s = await acmeSystem.script({
      seed: 502,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });

    await s.apply(hold, 'alice', 'sync');
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'transient' });
    expect(await s.observe(lastMutationOk, 'alice')).toBe(true);
    const mutationId = await s.observe(lastMutationId, 'alice');
    expect(mutationId).not.toBeNull();
    if (mutationId === null) return;

    // Held sync: the queued row stays pending for the whole window.
    await neverAcme(s, (s) => outcome(s, 'alice', mutationId), {
      forMs: 300,
    });

    await s.apply(release, 'alice', 'sync');
    await untilAcme(s, (s) => outcome(s, 'alice', mutationId));
    expect(await s.observe(outcome, 'alice', mutationId)).toBe('confirmed');
    await expectConverged(s);
    expect(await s.observe(liveNote, 'bob', 'n1')).toMatchObject({
      body: 'transient',
    });
  });
});
