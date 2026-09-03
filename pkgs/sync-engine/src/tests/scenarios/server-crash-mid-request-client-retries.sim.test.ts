import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeDraws,
  acmeSystem,
  addClient,
  crash,
  expectConverged,
  liveNote,
  mutate,
  net,
  passTime,
  restart,
  setNote,
  syncVirtualHost,
} from '../apps/acme';

describe('server crash mid request client retries', () => {
  test('server dies mid traffic; restart; clients retry and converge', async () => {
    await using run = await start(acmeSystem, {
      seed: 833,
      host: syncVirtualHost(),
      draws: acmeDraws({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });

    await run.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
    await expectConverged(run);

    {
      await run.apply(net, 'alice', 'sync', 'hold');
      await run.apply(mutate, 'alice', setNote, {
        id: 'n1',
        body: 'during-crash',
      });
      await run.apply(passTime, 20);
      await run.apply(crash, 'server');
      await run.apply(passTime, 50);
      await run.apply(restart, 'server', { preserveLocalDb: true });
    }
    await expectConverged(run);

    expect(await run.observe(liveNote('bob', 'n1'))).toMatchObject({
      body: 'during-crash',
    });

    // Query path also recovers after server restart.
    await run.apply(mutate, 'bob', setNote, {
      id: 'n2',
      body: 'after-restart',
    });
    await expectConverged(run);
    expect(await run.observe(liveNote('alice', 'n2'))).toMatchObject({
      body: 'after-restart',
    });
  });
});
