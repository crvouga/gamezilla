import { describe, expect, test } from 'bun:test';
import type { Run } from '@pkgs/dst';
import { start } from '@pkgs/dst';
import {
  acmeDraws,
  acmeSystem,
  addClient,
  expectConverged,
  foreground,
  mutate,
  online,
  passTime,
  type SyncSurface,
  setNote,
  syncVirtualHost,
} from '../apps/acme';
import { expectLiveNoteAt, liveNotes } from '../apps/acme/reads';

/** Bounce one lifecycle flag off and back on across a 25ms window. */
async function flapOnline(
  run: Run<SyncSurface>,
  clientId: string
): Promise<void> {
  await run.apply(online, clientId, false);
  await run.apply(passTime, 25);
  await run.apply(online, clientId, true);
}

async function flapForeground(run: Run<SyncSurface>): Promise<void> {
  await run.apply(foreground, 'alice', false);
  await run.apply(foreground, 'bob', false);
  await run.apply(passTime, 25);
  await run.apply(foreground, 'alice', true);
  await run.apply(foreground, 'bob', true);
}

describe('connect disconnect flapping under load', () => {
  test('online/foreground flap under mutation storm still converges', async () => {
    await using run = await start(acmeSystem, {
      seed: 1050,
      host: syncVirtualHost(),
      draws: acmeDraws({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');

    for (let i = 0; i < 24; i += 1) {
      await run.apply(mutate, 'alice', setNote, {
        id: `n-${String(i).padStart(2, '0')}`,
        body: `b${i}`,
      });
      if (i % 4 === 0) await flapOnline(run, 'bob');
      if (i % 5 === 0) await flapForeground(run);
      if (i % 6 === 0) await flapOnline(run, 'alice');
    }

    await run.apply(online, 'alice', true);
    await run.apply(foreground, 'alice', true);
    await run.apply(online, 'bob', true);
    await run.apply(foreground, 'bob', true);
    await expectConverged(run);
    expect((await run.observe(liveNotes('server'))).length).toBe(24);
    await expectLiveNoteAt(run, 'bob', 'n-00', { body: 'b0' });
    await expectLiveNoteAt(run, 'bob', 'n-23', { body: 'b23' });
  });

  test.each([1051, 1052, 1053])(
    'seed sweep flap + mutate converges (seed=%i)',
    async (seed) => {
      await using run = await start(acmeSystem, {
        seed,
        host: syncVirtualHost(),
        draws: acmeDraws({ clientCount: 0 }),
        properties: [],
      });

      await run.apply(addClient, 'alice');
      await run.apply(addClient, 'bob');
      for (let i = 0; i < 8; i += 1) {
        await run.apply(mutate, 'alice', setNote, {
          id: `n-${seed}-${i}`,
          body: `x${i}`,
        });
        await run.apply(online, 'bob', i % 2 === 0);
        await run.apply(passTime, 10);
        await run.apply(online, 'bob', true);
      }
      await expectConverged(run);
      await expectLiveNoteAt(run, 'bob', `n-${seed}-7`, { body: 'x7' });
    }
  );
});
