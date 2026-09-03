import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeDraws,
  acmeSystem,
  addClient,
  connect,
  converge,
  disconnect,
  liveNote,
  liveNotes,
  mutate,
  setNote,
  syncVirtualHost,
} from '../apps/acme';

const STORM = 150;

describe('mutation storm batching order preserved', () => {
  test('offline queue drains; last-write-wins body matches seq order', async () => {
    await using run = await start(acmeSystem, {
      seed: 1060,
      host: syncVirtualHost(),
      draws: acmeDraws({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });

    await run.apply(disconnect, 'alice');
    // Many updates to the same id — final body must be last mutate.
    for (let i = 0; i < STORM; i += 1) {
      await run.apply(mutate, 'alice', setNote, {
        id: 'storm-shared',
        body: `v${i}`,
      });
    }
    // Distinct ids preserve create order / full set.
    for (let i = 0; i < 40; i += 1) {
      await run.apply(mutate, 'alice', setNote, {
        id: `row-${String(i).padStart(3, '0')}`,
        body: `r${i}`,
      });
    }

    await run.apply(connect, 'alice');
    await run.apply(converge);

    expect(await run.observe(liveNote('bob', 'storm-shared'))).toMatchObject({
      body: `v${STORM - 1}`,
    });
    expect(await run.observe(liveNote('server', 'storm-shared'))).toMatchObject(
      {
        body: `v${STORM - 1}`,
      }
    );
    const server = await run.observe(liveNotes('server'));
    expect(server.some((n) => n.id === 'row-000')).toBe(true);
    expect(server.some((n) => n.id === 'row-039')).toBe(true);
    expect(await run.observe(liveNote('bob', 'row-039'))).toMatchObject({
      body: 'r39',
    });
  });

  test.each([1061, 1062, 1063])(
    'seed sweep modest storm preserves final body (seed=%i)',
    async (seed) => {
      await using run = await start(acmeSystem, {
        seed: seed,
        host: syncVirtualHost(),
        draws: acmeDraws({ clientCount: 0 }),
        properties: [],
      });

      await run.apply(addClient, { id: 'alice' });
      await run.apply(addClient, { id: 'bob' });
      await run.apply(disconnect, 'alice');
      for (let i = 0; i < 30; i += 1) {
        await run.apply(mutate, 'alice', setNote, {
          id: `s-${seed}`,
          body: `v${i}`,
        });
      }
      await run.apply(connect, 'alice');
      await run.apply(converge);
      expect(await run.observe(liveNote('server', `s-${seed}`))).toMatchObject({
        body: 'v29',
      });
    }
  );
});
