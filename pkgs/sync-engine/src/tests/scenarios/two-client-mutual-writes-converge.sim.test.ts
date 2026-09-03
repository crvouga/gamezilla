import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  expectConverged,
  liveNote,
  mutate,
  setNote,
  syncVirtualHost,
} from '../apps/acme';

describe('two client mutual writes converge', () => {
  test('peer sees note after expectConverged', async () => {
    await using run = await start(acmeSystem, {
      seed: 3,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'shared' });
    await expectConverged(run);
    expect(await run.observe(liveNote('bob', 'n1'))).toMatchObject({
      body: 'shared',
    });
  });

  test.each([1, 2, 42, 99])('seed sweep converges (seed=%i)', async (seed) => {
    await using run = await start(acmeSystem, {
      seed: seed,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');
    await run.apply(mutate, 'alice', setNote, {
      id: `n-${seed}`,
      body: `b-${seed}`,
    });
    await run.apply(mutate, 'bob', setNote, {
      id: `m-${seed}`,
      body: `c-${seed}`,
    });
    await expectConverged(run);
  });
});
