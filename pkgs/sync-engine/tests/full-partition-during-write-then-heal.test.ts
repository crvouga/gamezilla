import { describe, expect, test } from 'bun:test';
import {
  addClient,
  exampleSystem,
  expectInSync,
  liveNote,
  mutate,
  partition,
  resumeNetwork,
  setNote,
} from '@pkgs/sync-engine/sim';

describe('full partition during write then restoreNetwork', () => {
  test('partition then restoreNetwork staysInSync domain state', async () => {
    await using s = await exampleSystem.run({
      seed: 33,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });
    await s.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
    await expectInSync(s);

    await s.apply(partition, 'alice', 'all');
    await s.apply(partition, 'bob', 'all');
    await s.apply(mutate, 'alice', setNote, {
      id: 'n1',
      body: 'during-partition',
    });
    await s.advanceTime(100);
    await s.apply(resumeNetwork, 'alice', 'all');
    await s.apply(resumeNetwork, 'bob', 'all');
    await expectInSync(s);

    expect(await s.read(liveNote, 'bob', 'n1')).toMatchObject({
      body: 'during-partition',
    });
  });
});
