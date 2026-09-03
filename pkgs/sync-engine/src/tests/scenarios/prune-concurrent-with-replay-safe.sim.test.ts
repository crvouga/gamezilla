import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  expectConverged,
  httpFault,
  liveNote,
  liveNotes,
  mutate,
  passTime,
  serverPrune,
  setNote,
  syncVirtualHost,
} from '../apps/acme';

describe('prune concurrent with replay safe', () => {
  test('prune interleaved with uploads; retries dedupe; the run converges', async () => {
    await using run = await start(acmeSystem, {
      seed: 940,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });

    await run.apply(mutate, 'alice', setNote, {
      id: 'n-kept',
      body: 'before-prune',
    });
    await expectConverged(run);

    for (let i = 0; i < 8; i += 1) {
      if (i % 2 === 0) {
        await run.apply(httpFault, 'alice', { kind: 'dropMutationsResponse' });
      }
      await run.apply(mutate, 'alice', setNote, {
        id: `n-${String(i).padStart(2, '0')}`,
        body: `b${i}`,
      });
      await run.apply(serverPrune, 0);
      await run.apply(passTime, 40);
    }

    await expectConverged(run);
    const server = await run.observe(liveNotes('server'));
    const ids = server.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('n-kept');
    expect(ids).toContain('n-07');
    expect(await run.observe(liveNote('bob', 'n-07'))).toMatchObject({
      body: 'b7',
    });
    expect(await run.observe(liveNote('bob', 'n-kept'))).toMatchObject({
      body: 'before-prune',
    });
  });

  test.each([941, 942, 943])(
    'seed sweep prune + mutate converges (seed=%i)',
    async (seed) => {
      await using run = await start(acmeSystem, {
        seed: seed,
        host: syncVirtualHost(),
        knobs: acmeKnobs({ clientCount: 0 }),
        properties: [],
      });

      await run.apply(addClient, { id: 'alice' });
      await run.apply(addClient, { id: 'bob' });
      await run.apply(mutate, 'alice', setNote, { id: `n-${seed}`, body: 'x' });
      await run.apply(serverPrune, 0);
      await run.apply(mutate, 'alice', setNote, { id: `m-${seed}`, body: 'y' });
      await run.apply(serverPrune, 0);
      await expectConverged(run);
      expect(await run.observe(liveNote('server', `n-${seed}`))).toMatchObject({
        body: 'x',
      });
      expect(await run.observe(liveNote('server', `m-${seed}`))).toMatchObject({
        body: 'y',
      });
    }
  );
});
