import { describe, test } from 'bun:test';
import { script } from '@pkgs/dst';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  expectConverged,
  mutate,
  online,
  passTime,
  setNote,
  syncVirtualHost,
} from '../apps/acme';

describe('remote fanout races local pending mutation', () => {
  test('fanout races local pending mutation on same row then converges', async () => {
    await using run = await script(acmeSystem, {
      seed: 29,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');

    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'from-a' });
    await expectConverged(run);

    await run.apply(online, 'bob', false);
    await run.apply(mutate, 'bob', setNote, {
      id: 'n1',
      body: 'from-b-pending',
    });
    await run.apply(online, 'bob', true);
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'from-a-2' });
    await run.apply(passTime, 500);
    await expectConverged(run);
  });
});
