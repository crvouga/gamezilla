import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  expectConverged,
  liveNote,
  mutate,
  partition,
  passTime,
  release,
  setNote,
  syncVirtualHost,
} from '../apps/acme';

describe('full partition during write then heal', () => {
  test('partition then heal converges domain state', async () => {
    await using run = await start(acmeSystem, {
      seed: 33,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });
    await run.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
    await expectConverged(run);

    await run.apply(partition, 'alice', 'all');
    await run.apply(partition, 'bob', 'all');
    await run.apply(mutate, 'alice', setNote, {
      id: 'n1',
      body: 'during-partition',
    });
    await run.apply(passTime, 100);
    await run.apply(release, 'alice', 'all');
    await run.apply(release, 'bob', 'all');
    await expectConverged(run);

    expect(await run.observe(liveNote('bob', 'n1'))).toMatchObject({
      body: 'during-partition',
    });
  });
});
