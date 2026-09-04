import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  expectConverged,
  lastMutationFailures,
  lastMutationId,
  lastMutationOk,
  liveNote,
  mutate,
  online,
  outcome,
  requiresOnlineNote,
  untilAcme,
} from '../apps/acme';

describe('requires online fails offline without queue', () => {
  test('offline mutate fails with OFFLINE and does not queue', async () => {
    await using s = await acmeSystem.script({
      seed: 510,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(online, 'alice', false);

    await s.apply(mutate, 'alice', requiresOnlineNote, {
      id: 'n1',
      body: 'need-net',
    });
    expect(await s.observe(lastMutationOk, 'alice')).toBe(false);
    expect(await s.observe(lastMutationFailures, 'alice')).toContain('OFFLINE');

    await s.apply(online, 'alice', true);
    await s.apply(mutate, 'alice', requiresOnlineNote, {
      id: 'n1',
      body: 'online-ok',
    });
    expect(await s.observe(lastMutationOk, 'alice')).toBe(true);
    const okId = await s.observe(lastMutationId, 'alice');
    expect(okId).not.toBeNull();
    if (okId === null) return;

    await untilAcme(s, (s) => outcome(s, 'alice', okId));
    expect(await s.observe(outcome, 'alice', okId)).toBe('confirmed');
    await expectConverged(s);
    expect(await s.observe(liveNote, 'alice', 'n1')).toMatchObject({
      body: 'online-ok',
    });
  });
});
