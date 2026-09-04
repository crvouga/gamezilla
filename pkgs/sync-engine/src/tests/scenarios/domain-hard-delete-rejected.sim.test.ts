import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  expectConverged,
  illegalHardDeleteNote,
  lastMutationFailures,
  lastMutationOk,
  liveNote,
  mutate,
  setNote,
} from '../apps/acme';

describe('domain hard delete rejected', () => {
  test('illegalHardDeleteNote fails with NO_HARD_DELETE; row stays live', async () => {
    await using s = await acmeSystem.script({
      seed: 60,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'keep-me' });
    await expectConverged(s);

    await s.apply(mutate, 'alice', illegalHardDeleteNote, { id: 'n1' });
    expect(await s.observe(lastMutationOk, 'alice')).toBe(false);
    expect(await s.observe(lastMutationFailures, 'alice')).toContain(
      'NO_HARD_DELETE'
    );

    expect(await s.observe(liveNote, 'alice', 'n1')).toMatchObject({
      body: 'keep-me',
    });
    expect(await s.observe(liveNote, 'server', 'n1')).toMatchObject({
      body: 'keep-me',
    });
  });
});
