import { describe, expect, test } from 'bun:test';
import { script } from '@pkgs/dst';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  deleteNote,
  expectConverged,
  lastMutationFailures,
  lastMutationOk,
  liveNote,
  mutate,
  setNote,
  syncVirtualHost,
} from '../apps/acme';

describe('non owner mutation denied owner converges', () => {
  test('non-owner delete is rejected; note stays live on peers', async () => {
    await using run = await script(acmeSystem, {
      seed: 50,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');

    await run.apply(mutate, 'alice', setNote, {
      id: 'n1',
      body: 'owned-by-alice',
    });
    await expectConverged(run);

    await run.apply(mutate, 'bob', deleteNote, { id: 'n1' });
    expect(await run.observe(lastMutationOk('bob'))).toBe(false);
    expect(await run.observe(lastMutationFailures('bob'))).toContain(
      'FORBIDDEN'
    );

    await expectConverged(run);
    expect(await run.observe(liveNote('alice', 'n1'))).toMatchObject({
      body: 'owned-by-alice',
    });
    expect(await run.observe(liveNote('bob', 'n1'))).toMatchObject({
      body: 'owned-by-alice',
    });
  });

  test('owner delete succeeds', async () => {
    await using run = await script(acmeSystem, {
      seed: 51,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'x' });
    await expectConverged(run);
    await run.apply(mutate, 'alice', deleteNote, { id: 'n1' });
    const okOk = await run.observe(lastMutationOk('alice'));
    expect(okOk).toBe(true);
    await expectConverged(run);
    expect(await run.observe(liveNote('bob', 'n1'))).toMatchObject({
      deletedAt: expect.any(String),
    });
  });
});
