import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  expectConverged,
  httpFault,
  liveNote,
  liveNotes,
  mutate,
  serverPrune,
  setNote,
} from '../apps/acme';

describe('prune concurrent with replay safe', () => {
  test('prune interleaved with uploads; retries dedupe; the run converges', async () => {
    await using s = await acmeSystem.script({
      seed: 940,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });

    await s.apply(mutate, 'alice', setNote, {
      id: 'n-kept',
      body: 'before-prune',
    });
    await expectConverged(s);

    for (let i = 0; i < 8; i += 1) {
      if (i % 2 === 0) {
        await s.apply(httpFault, 'alice', { kind: 'dropMutationsResponse' });
      }
      await s.apply(mutate, 'alice', setNote, {
        id: `n-${String(i).padStart(2, '0')}`,
        body: `b${i}`,
      });
      await s.apply(serverPrune, 0);
      await s.elapse(40);
    }

    await expectConverged(s);
    const server = await s.observe(liveNotes, 'server');
    const ids = server.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('n-kept');
    expect(ids).toContain('n-07');
    expect(await s.observe(liveNote, 'bob', 'n-07')).toMatchObject({
      body: 'b7',
    });
    expect(await s.observe(liveNote, 'bob', 'n-kept')).toMatchObject({
      body: 'before-prune',
    });
  });

  test.each([941, 942, 943])(
    'seed sweep prune + mutate converges (seed=%i)',
    async (seed) => {
      await using s = await acmeSystem.script({
        seed: seed,
        args: { clientCount: 0 },
      });

      await s.apply(addClient, { id: 'alice' });
      await s.apply(addClient, { id: 'bob' });
      await s.apply(mutate, 'alice', setNote, { id: `n-${seed}`, body: 'x' });
      await s.apply(serverPrune, 0);
      await s.apply(mutate, 'alice', setNote, { id: `m-${seed}`, body: 'y' });
      await s.apply(serverPrune, 0);
      await expectConverged(s);
      expect(await s.observe(liveNote, 'server', `n-${seed}`)).toMatchObject({
        body: 'x',
      });
      expect(await s.observe(liveNote, 'server', `m-${seed}`)).toMatchObject({
        body: 'y',
      });
    }
  );
});
