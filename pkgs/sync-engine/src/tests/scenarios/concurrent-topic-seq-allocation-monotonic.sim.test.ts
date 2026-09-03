import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeDraws,
  acmeSystem,
  addClient,
  converge,
  liveNote,
  liveNotes,
  mutate,
  passTime,
  setNote,
  settle,
  syncVirtualHost,
} from '../apps/acme';

describe('concurrent topic seq allocation monotonic', () => {
  test('overlapping mutates on shared topic converge without torn state', async () => {
    await using run = await start(acmeSystem, {
      seed: 920,
      host: syncVirtualHost(),
      draws: acmeDraws({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });

    // Both writers hit the same topic back to back, so seq allocation overlaps
    // inside the server without a settle between them.
    for (let i = 0; i < 12; i += 1) {
      const suffix = String(i).padStart(2, '0');
      await run.apply(mutate, 'alice', setNote, {
        id: `a-${suffix}`,
        body: `a${i}`,
      });
      await run.apply(mutate, 'bob', setNote, {
        id: `b-${suffix}`,
        body: `b${i}`,
      });
      if (i % 3 === 0) await run.apply(passTime, 5);
    }
    await run.apply(converge);
    await run.apply(settle);

    expect((await run.observe(liveNotes('server'))).length).toBe(24);
    expect(await run.observe(liveNote('alice', 'a-00'))).toMatchObject({
      body: 'a0',
    });
    expect(await run.observe(liveNote('bob', 'b-11'))).toMatchObject({
      body: 'b11',
    });
  });

  test.each([921, 922, 923])(
    'seed sweep concurrent writers converge (seed=%i)',
    async (seed) => {
      await using run = await start(acmeSystem, {
        seed: seed,
        host: syncVirtualHost(),
        draws: acmeDraws({ clientCount: 0 }),
        properties: [],
      });

      await run.apply(addClient, { id: 'alice' });
      await run.apply(addClient, { id: 'bob' });
      await run.apply(mutate, 'alice', setNote, { id: `a-${seed}`, body: 'x' });
      await run.apply(mutate, 'bob', setNote, { id: `b-${seed}`, body: 'y' });
      await run.apply(converge);
      await run.apply(settle);
      expect((await run.observe(liveNotes('server'))).length).toBe(2);
    }
  );
});
