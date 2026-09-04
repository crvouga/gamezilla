import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  expectConverged,
  liveNote,
  mutate,
  setNote,
} from '../apps/acme';

describe('two client mutual writes converge', () => {
  test('peer sees note after expectConverged', async () => {
    await using s = await acmeSystem.script({
      seed: 3,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'shared' });
    await expectConverged(s);
    expect(await s.observe(liveNote, 'bob', 'n1')).toMatchObject({
      body: 'shared',
    });
  });

  test.each([1, 2, 42, 99])('seed sweep converges (seed=%i)', async (seed) => {
    await using s = await acmeSystem.script({
      seed: seed,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');
    await s.apply(mutate, 'alice', setNote, {
      id: `n-${seed}`,
      body: `b-${seed}`,
    });
    await s.apply(mutate, 'bob', setNote, {
      id: `m-${seed}`,
      body: `c-${seed}`,
    });
    await expectConverged(s);
  });
});
