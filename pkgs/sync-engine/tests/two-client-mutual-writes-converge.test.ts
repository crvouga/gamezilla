import { describe, expect, test } from 'bun:test';
import {
  addClient,
  exampleSystem,
  expectInSync,
  liveNote,
  mutate,
  setNote,
} from '@pkgs/sync-engine/sim';

describe('two client mutual writes converge', () => {
  test('peer sees note after expectInSync', async () => {
    await using s = await exampleSystem.run({
      seed: 3,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'shared' });
    await expectInSync(s);
    expect(await s.read(liveNote, 'bob', 'n1')).toMatchObject({
      body: 'shared',
    });
  });

  test.each([1, 2, 42, 99])(
    'seed sweep staysInSync (seed=%i)',
    async (seed) => {
      await using s = await exampleSystem.run({
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
      await expectInSync(s);
    }
  );
});
