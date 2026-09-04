import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  expectConverged,
  liveNote,
  mutate,
  net,
  nudge,
  setNote,
} from '../apps/acme';

describe('row image apply then refetch not not modified', () => {
  test('live row-image paint while sync held still converges after refetch', async () => {
    // Row images must not advance content hash; release+refetch stays sound.
    await using s = await acmeSystem.script({
      seed: 801,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });

    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'seed' });
    await s.apply(mutate, 'alice', setNote, { id: 'n2', body: 'other' });
    await expectConverged(s);

    {
      await s.apply(net, 'bob', 'sync', 'hold');
      await s.apply(mutate, 'alice', setNote, {
        id: 'n1',
        body: 'via-image',
      });
      await s.elapse(300);
      expect(await s.observe(liveNote, 'bob', 'n1')).toMatchObject({
        body: 'via-image',
      });
      expect(await s.observe(liveNote, 'bob', 'n2')).toMatchObject({
        body: 'other',
      });
    }
    // nudge: release sync — refetch must not be not-modified after row-image paint
    await s.apply(nudge, 'bob');
    await expectConverged(s);
    expect(await s.observe(liveNote, 'bob', 'n1')).toMatchObject({
      body: 'via-image',
    });
  });
});
