import { describe, expect, test } from 'bun:test';
import { script } from '@pkgs/dst';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  expectConverged,
  liveNote,
  mutate,
  net,
  setNote,
  syncVirtualHost,
} from '../apps/acme';

describe('dropped live repaired by refetch', () => {
  test('dropped fanout converges via refetch after heal', async () => {
    await using run = await script(acmeSystem, {
      seed: 11,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });

    {
      await run.apply(net, 'bob', 'live', { dropProbability: 1 });
      await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'lost' });
      await run.elapse(50);
      await run.apply(net, 'bob', 'live', 'ok');
    }
    await expectConverged(run);

    expect(await run.observe(liveNote, 'bob', 'n1')).toMatchObject({
      body: 'lost',
    });
  });

  test('reorder window still converges', async () => {
    await using run = await script(acmeSystem, {
      seed: 12,
      host: syncVirtualHost(),
      knobs: acmeKnobs({
        clientCount: 0,
      }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'a' });
    await run.apply(mutate, 'alice', setNote, { id: 'n2', body: 'b' });
    await run.apply(mutate, 'alice', setNote, { id: 'n3', body: 'c' });
    await expectConverged(run);
    expect(await run.observe(liveNote, 'bob', 'n2')).toMatchObject({
      body: 'b',
    });
  });

  test('duplicate delivery still converges', async () => {
    await using run = await script(acmeSystem, {
      seed: 15,
      host: syncVirtualHost(),
      knobs: acmeKnobs({
        clientCount: 0,
      }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'dup' });
    await expectConverged(run);
    expect(await run.observe(liveNote, 'bob', 'n1')).toMatchObject({
      body: 'dup',
    });
  });
});
