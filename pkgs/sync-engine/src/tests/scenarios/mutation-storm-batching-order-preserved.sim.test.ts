import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  connect,
  disconnect,
  expectConverged,
  liveNote,
  liveNotes,
  mutate,
  setNote,
} from '../apps/acme';

const STORM = 150;

describe('mutation storm batching order preserved', () => {
  test('offline queue drains; last-write-wins body matches seq order', async () => {
    await using s = await acmeSystem.script({
      seed: 1060,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });

    await s.apply(disconnect, 'alice');
    // Many updates to the same id — final body must be last mutate.
    for (let i = 0; i < STORM; i += 1) {
      await s.apply(mutate, 'alice', setNote, {
        id: 'storm-shared',
        body: `v${i}`,
      });
    }
    // Distinct ids preserve create order / full set.
    for (let i = 0; i < 40; i += 1) {
      await s.apply(mutate, 'alice', setNote, {
        id: `row-${String(i).padStart(3, '0')}`,
        body: `r${i}`,
      });
    }

    await s.apply(connect, 'alice');
    await expectConverged(s);

    expect(await s.observe(liveNote, 'bob', 'storm-shared')).toMatchObject({
      body: `v${STORM - 1}`,
    });
    expect(await s.observe(liveNote, 'server', 'storm-shared')).toMatchObject({
      body: `v${STORM - 1}`,
    });
    const server = await s.observe(liveNotes, 'server');
    expect(server.some((n) => n.id === 'row-000')).toBe(true);
    expect(server.some((n) => n.id === 'row-039')).toBe(true);
    expect(await s.observe(liveNote, 'bob', 'row-039')).toMatchObject({
      body: 'r39',
    });
  });

  test.each([1061, 1062, 1063])(
    'seed sweep modest storm preserves final body (seed=%i)',
    async (seed) => {
      await using s = await acmeSystem.script({
        seed: seed,
        args: { clientCount: 0 },
      });

      await s.apply(addClient, { id: 'alice' });
      await s.apply(addClient, { id: 'bob' });
      await s.apply(disconnect, 'alice');
      for (let i = 0; i < 30; i += 1) {
        await s.apply(mutate, 'alice', setNote, {
          id: `s-${seed}`,
          body: `v${i}`,
        });
      }
      await s.apply(connect, 'alice');
      await expectConverged(s);
      expect(await s.observe(liveNote, 'server', `s-${seed}`)).toMatchObject({
        body: 'v29',
      });
    }
  );
});
