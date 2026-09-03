import { describe, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeDraws,
  acmeSystem,
  addClient,
  converge,
  mutate,
  online,
  passTime,
  setNote,
  syncVirtualHost,
} from '../apps/acme';

describe('remote fanout races local pending mutation', () => {
  test('fanout races local pending mutation on same row then converges', async () => {
    await using run = await start(acmeSystem, {
      seed: 29,
      host: syncVirtualHost(),
      draws: acmeDraws({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');

    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'from-a' });
    await run.apply(converge);

    await run.apply(online, 'bob', false);
    await run.apply(mutate, 'bob', setNote, {
      id: 'n1',
      body: 'from-b-pending',
    });
    await run.apply(online, 'bob', true);
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'from-a-2' });
    await run.apply(passTime, 500);
    await run.apply(converge);
  });
});
