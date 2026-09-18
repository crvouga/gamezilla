// goal:works-offline:6
import { describe, expect, test } from 'bun:test';
import {
  addClient,
  exampleSystem,
  expectInSync,
  lastMutationFailures,
  lastMutationId,
  lastMutationOk,
  liveNote,
  mutate,
  online,
  outcome,
  requiresOnlineNote,
  untilExample,
} from '@pkgs/sync-engine/sim';

describe('requires online fails offline without queue', () => {
  test('offline mutate fails with OFFLINE and does not queue', async () => {
    await using s = await exampleSystem.run({
      seed: 510,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(online, 'alice', false);

    await s.apply(mutate, 'alice', requiresOnlineNote, {
      id: 'n1',
      body: 'need-net',
    });
    expect(await s.read(lastMutationOk, 'alice')).toBe(false);
    expect(await s.read(lastMutationFailures, 'alice')).toContain('OFFLINE');

    await s.apply(online, 'alice', true);
    await s.apply(mutate, 'alice', requiresOnlineNote, {
      id: 'n1',
      body: 'online-ok',
    });
    expect(await s.read(lastMutationOk, 'alice')).toBe(true);
    const okId = await s.read(lastMutationId, 'alice');
    expect(okId).not.toBeNull();
    if (okId === null) return;

    await untilExample(s, (s) => outcome(s, 'alice', okId));
    expect(await s.read(outcome, 'alice', okId)).toBe('confirmed');
    await expectInSync(s);
    expect(await s.read(liveNote, 'alice', 'n1')).toMatchObject({
      body: 'online-ok',
    });
  });
});
