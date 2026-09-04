import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  expectConverged,
  hold,
  liveNote,
  mutate,
  net,
  release,
  setNote,
} from '../apps/acme';

describe('push seq gap forces refetch not image apply', () => {
  test('lost live push creates gap; later push still converges via refetch', async () => {
    await using s = await acmeSystem.script({
      seed: 804,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });

    await s.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
    await expectConverged(s);

    // Drop the next live fanout (gap), keep sync so repair can refetch.
    await s.apply(net, 'bob', 'live', { dropProbability: 1 });
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'lost-push' });
    await s.elapse(80);
    await s.apply(net, 'bob', 'live', 'ok');

    // Contiguous-looking later push must not image-apply across the gap.
    await s.apply(hold, 'bob', 'sync');
    await s.apply(mutate, 'alice', setNote, { id: 'n2', body: 'after-gap' });
    await s.elapse(200);
    await s.apply(release, 'bob', 'sync');
    await expectConverged(s);

    expect(await s.observe(liveNote, 'bob', 'n1')).toMatchObject({
      body: 'lost-push',
    });
    expect(await s.observe(liveNote, 'bob', 'n2')).toMatchObject({
      body: 'after-gap',
    });
  });
});
