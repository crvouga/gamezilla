import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  deleteNote,
  expectConverged,
  lastMutationFailures,
  lastMutationOk,
  liveNote,
  mutate,
  setNote,
} from '../apps/acme';

describe('non owner mutation denied owner converges', () => {
  test('non-owner delete is rejected; note stays live on peers', async () => {
    await using s = await acmeSystem.script({
      seed: 50,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');

    await s.apply(mutate, 'alice', setNote, {
      id: 'n1',
      body: 'owned-by-alice',
    });
    await expectConverged(s);

    await s.apply(mutate, 'bob', deleteNote, { id: 'n1' });
    expect(await s.observe(lastMutationOk, 'bob')).toBe(false);
    expect(await s.observe(lastMutationFailures, 'bob')).toContain('FORBIDDEN');

    await expectConverged(s);
    expect(await s.observe(liveNote, 'alice', 'n1')).toMatchObject({
      body: 'owned-by-alice',
    });
    expect(await s.observe(liveNote, 'bob', 'n1')).toMatchObject({
      body: 'owned-by-alice',
    });
  });

  test('owner delete succeeds', async () => {
    await using s = await acmeSystem.script({
      seed: 51,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'x' });
    await expectConverged(s);
    await s.apply(mutate, 'alice', deleteNote, { id: 'n1' });
    const okOk = await s.observe(lastMutationOk, 'alice');
    expect(okOk).toBe(true);
    await expectConverged(s);
    expect(await s.observe(liveNote, 'bob', 'n1')).toMatchObject({
      deletedAt: expect.any(String),
    });
  });
});
