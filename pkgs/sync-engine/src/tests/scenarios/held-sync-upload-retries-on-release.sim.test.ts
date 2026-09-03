import { describe, expect, test } from 'bun:test';
import { script } from '@pkgs/dst';
import {
  acmeKnobs,
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
  syncVirtualHost,
  untilAcme,
} from '../apps/acme';

describe('held sync upload retries on release', () => {
  test('held sync keeps queue pending then confirms after release', async () => {
    await using run = await script(acmeSystem, {
      seed: 502,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });

    await run.apply(hold, 'alice', 'sync');
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'transient' });
    expect(await run.observe(lastMutationOk('alice'))).toBe(true);
    const mutationId = await run.observe(lastMutationId('alice'));
    expect(mutationId).not.toBeNull();
    if (mutationId === null) return;

    // Held sync: the queued row stays pending for the whole window.
    await neverAcme(run, outcome('alice', mutationId), { forMs: 300 });

    await run.apply(release, 'alice', 'sync');
    await untilAcme(run, outcome('alice', mutationId));
    expect(await run.observe(outcome('alice', mutationId))).toBe('confirmed');
    await expectConverged(run);
    expect(await run.observe(liveNote('bob', 'n1'))).toMatchObject({
      body: 'transient',
    });
  });
});
