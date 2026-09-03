import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
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

describe('reordered http responses stale checkpoint dropped', () => {
  test('reordered sync responses never regress newer domain rows', async () => {
    await using run = await start(acmeSystem, {
      seed: 802,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });
    await run.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
    await expectConverged(run);

    await run.apply(net, 'bob', 'sync', {
      latencyMeanMs: 20,
      latencyJitterMs: 40,
      reorderWindow: 6,
    });

    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'v1' });
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'v2' });
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'v3-final' });
    await run.apply(mutate, 'alice', setNote, { id: 'n2', body: 'side' });
    await expectConverged(run);

    expect(await run.observe(liveNote('bob', 'n1'))).toMatchObject({
      body: 'v3-final',
    });
    expect(await run.observe(liveNote('bob', 'n2'))).toMatchObject({
      body: 'side',
    });
  });
});
