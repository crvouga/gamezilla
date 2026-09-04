import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  expectConverged,
  liveNote,
  mutate,
  partition,
  release,
  setNote,
} from '../apps/acme';

describe('full partition during write then heal', () => {
  test('partition then heal converges domain state', async () => {
    await using s = await acmeSystem.script({
      seed: 33,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });
    await s.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
    await expectConverged(s);

    await s.apply(partition, 'alice', 'all');
    await s.apply(partition, 'bob', 'all');
    await s.apply(mutate, 'alice', setNote, {
      id: 'n1',
      body: 'during-partition',
    });
    await s.elapse(100);
    await s.apply(release, 'alice', 'all');
    await s.apply(release, 'bob', 'all');
    await expectConverged(s);

    expect(await s.observe(liveNote, 'bob', 'n1')).toMatchObject({
      body: 'during-partition',
    });
  });
});
