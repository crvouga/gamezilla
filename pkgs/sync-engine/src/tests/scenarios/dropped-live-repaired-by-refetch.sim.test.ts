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

describe('dropped live repaired by refetch', () => {
  test('dropped fanout converges via refetch after heal', async () => {
    await using s = await acmeSystem.script({
      seed: 11,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });

    {
      await s.apply(net, 'bob', 'live', { dropProbability: 1 });
      await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'lost' });
      await s.elapse(50);
      await s.apply(net, 'bob', 'live', 'ok');
    }
    await expectConverged(s);

    expect(await s.observe(liveNote, 'bob', 'n1')).toMatchObject({
      body: 'lost',
    });
  });

  test('reorder window still converges', async () => {
    await using s = await acmeSystem.script({
      seed: 12,
      args: {
        clientCount: 0,
      },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'a' });
    await s.apply(mutate, 'alice', setNote, { id: 'n2', body: 'b' });
    await s.apply(mutate, 'alice', setNote, { id: 'n3', body: 'c' });
    await expectConverged(s);
    expect(await s.observe(liveNote, 'bob', 'n2')).toMatchObject({
      body: 'b',
    });
  });

  test('duplicate delivery still converges', async () => {
    await using s = await acmeSystem.script({
      seed: 15,
      args: {
        clientCount: 0,
      },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'dup' });
    await expectConverged(s);
    expect(await s.observe(liveNote, 'bob', 'n1')).toMatchObject({
      body: 'dup',
    });
  });
});
