import { describe, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  expectConverged,
  mutate,
  online,
  setNote,
} from '../apps/acme';

describe('remote fanout races local pending mutation', () => {
  test('fanout races local pending mutation on same row then converges', async () => {
    await using s = await acmeSystem.script({
      seed: 29,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');

    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'from-a' });
    await expectConverged(s);

    await s.apply(online, 'bob', false);
    await s.apply(mutate, 'bob', setNote, {
      id: 'n1',
      body: 'from-b-pending',
    });
    await s.apply(online, 'bob', true);
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'from-a-2' });
    await s.elapse(500);
    await expectConverged(s);
  });
});
