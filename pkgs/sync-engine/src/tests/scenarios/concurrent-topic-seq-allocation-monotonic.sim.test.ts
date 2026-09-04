import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  expectConverged,
  liveNote,
  liveNotes,
  mutate,
  setNote,
} from '../apps/acme';

describe('concurrent topic seq allocation monotonic', () => {
  test('overlapping mutates on shared topic converge without torn state', async () => {
    await using s = await acmeSystem.script({
      seed: 920,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });
    // Fire many overlapping mutates; occasional elapse lets the batcher flush
    // inside the server without a settle between them.
    for (let i = 0; i < 12; i += 1) {
      await s.apply(mutate, 'alice', setNote, {
        id: `a-${String(i).padStart(2, '0')}`,
        body: `a${i}`,
      });
      await s.apply(mutate, 'bob', setNote, {
        id: `b-${String(i).padStart(2, '0')}`,
        body: `b${i}`,
      });
      if (i % 3 === 0) await s.elapse(5);
    }
    await expectConverged(s);

    expect((await s.observe(liveNotes, 'server')).length).toBe(24);
    expect(await s.observe(liveNote, 'alice', 'a-00')).toMatchObject({
      body: 'a0',
    });
    expect(await s.observe(liveNote, 'bob', 'b-11')).toMatchObject({
      body: 'b11',
    });
  });

  test.each([921, 922, 923])(
    'seed sweep concurrent writers converge (seed=%i)',
    async (seed) => {
      await using s = await acmeSystem.script({
        seed: seed,
        args: { clientCount: 0 },
      });

      await s.apply(addClient, { id: 'alice' });
      await s.apply(addClient, { id: 'bob' });
      await s.apply(mutate, 'alice', setNote, { id: `a-${seed}`, body: 'x' });
      await s.apply(mutate, 'bob', setNote, { id: `b-${seed}`, body: 'y' });
      await expectConverged(s);
      expect((await s.observe(liveNotes, 'server')).length).toBe(2);
    }
  );
});
