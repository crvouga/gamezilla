import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  crash,
  expectConverged,
  liveNote,
  mutate,
  net,
  restart,
  setNote,
} from '../apps/acme';

describe('server crash mid request client retries', () => {
  test('server dies mid traffic; restart; clients retry and converge', async () => {
    await using s = await acmeSystem.script({
      seed: 833,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });

    await s.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
    await expectConverged(s);

    {
      await s.apply(net, 'alice', 'sync', 'hold');
      await s.apply(mutate, 'alice', setNote, {
        id: 'n1',
        body: 'during-crash',
      });
      await s.elapse(20);
      await s.apply(crash, 'server');
      await s.elapse(50);
      await s.apply(restart, 'server', { preserveLocalDb: true });
    }
    await expectConverged(s);

    expect(await s.observe(liveNote, 'bob', 'n1')).toMatchObject({
      body: 'during-crash',
    });

    // Query path also recovers after server restart.
    await s.apply(mutate, 'bob', setNote, {
      id: 'n2',
      body: 'after-restart',
    });
    await expectConverged(s);
    expect(await s.observe(liveNote, 'alice', 'n2')).toMatchObject({
      body: 'after-restart',
    });
  });
});
