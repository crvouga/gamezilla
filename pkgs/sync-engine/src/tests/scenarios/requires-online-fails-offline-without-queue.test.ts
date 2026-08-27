import { describe, expect, test } from 'bun:test';
import {
  expectLiveNote,
  acmeDomainPack,
  requiresOnlineNote,
} from '../apps/acme';
import { openSimWorld } from '../../sim/world';

describe('requires online fails offline without queue', () => {
  test('offline mutate fails with OFFLINE and does not queue', async () => {
    await using world = await openSimWorld({
      domain: acmeDomainPack,
      seed: 510,
    });
    const a = await world.addClient({ id: 'alice' });
    a.online(false);

    const denied = await a.mutate(requiresOnlineNote, {
      id: 'n1',
      body: 'need-net',
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.failures.some((f) => f.code === 'OFFLINE')).toBe(true);
    }

    a.online(true);
    const ok = await a.mutate(requiresOnlineNote, {
      id: 'n1',
      body: 'online-ok',
    });
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;

    await world.until(a.outcome(ok.mutationId), { budgetMs: 5_000 });
    expect(await a.outcome(ok.mutationId)).toBe('confirmed');
    await world.assertConverged();
    await expectLiveNote(a.db, 'n1', { body: 'online-ok' });
  });
});
