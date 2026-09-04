import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  expectConverged,
  liveNote,
  mutate,
  net,
  setNote,
} from '../apps/acme';

describe('reordered http responses stale checkpoint dropped', () => {
  test('reordered sync responses never regress newer domain rows', async () => {
    await using s = await acmeSystem.script({
      seed: 802,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });
    await s.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
    await expectConverged(s);

    await s.apply(net, 'bob', 'sync', {
      latencyMeanMs: 20,
      latencyJitterMs: 40,
      reorderWindow: 6,
    });

    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'v1' });
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'v2' });
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'v3-final' });
    await s.apply(mutate, 'alice', setNote, { id: 'n2', body: 'side' });
    await expectConverged(s);

    expect(await s.observe(liveNote, 'bob', 'n1')).toMatchObject({
      body: 'v3-final',
    });
    expect(await s.observe(liveNote, 'bob', 'n2')).toMatchObject({
      body: 'side',
    });
  });
});
