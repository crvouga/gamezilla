import { describe, expect, test } from 'bun:test';
import type { Script } from '@pkgs/dst';
import {
  acmeSystem,
  addClient,
  expectConverged,
  foreground,
  mutate,
  online,
  type SyncSurface,
  setNote,
} from '../apps/acme';
import { expectLiveNoteAt, liveNotes } from '../apps/acme/reads';

/** Bounce one lifecycle flag off and back on across a 25ms window. */
async function flapOnline(
  s: Script<SyncSurface>,
  clientId: string
): Promise<void> {
  await s.apply(online, clientId, false);
  await s.elapse(25);
  await s.apply(online, clientId, true);
}

async function flapForeground(s: Script<SyncSurface>): Promise<void> {
  await s.apply(foreground, 'alice', false);
  await s.apply(foreground, 'bob', false);
  await s.elapse(25);
  await s.apply(foreground, 'alice', true);
  await s.apply(foreground, 'bob', true);
}

describe('connect disconnect flapping under load', () => {
  test('online/foreground flap under mutation storm still converges', async () => {
    await using s = await acmeSystem.script({
      seed: 1050,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');

    for (let i = 0; i < 24; i += 1) {
      await s.apply(mutate, 'alice', setNote, {
        id: `n-${String(i).padStart(2, '0')}`,
        body: `b${i}`,
      });
      if (i % 4 === 0) await flapOnline(s, 'bob');
      if (i % 5 === 0) await flapForeground(s);
      if (i % 6 === 0) await flapOnline(s, 'alice');
    }

    await s.apply(online, 'alice', true);
    await s.apply(foreground, 'alice', true);
    await s.apply(online, 'bob', true);
    await s.apply(foreground, 'bob', true);
    await expectConverged(s);
    expect((await s.observe(liveNotes, 'server')).length).toBe(24);
    await expectLiveNoteAt(s, 'bob', 'n-00', { body: 'b0' });
    await expectLiveNoteAt(s, 'bob', 'n-23', { body: 'b23' });
  });

  test.each([1051, 1052, 1053])(
    'seed sweep flap + mutate converges (seed=%i)',
    async (seed) => {
      await using s = await acmeSystem.script({
        seed,
        args: { clientCount: 0 },
      });

      await s.apply(addClient, 'alice');
      await s.apply(addClient, 'bob');
      for (let i = 0; i < 8; i += 1) {
        await s.apply(mutate, 'alice', setNote, {
          id: `n-${seed}-${i}`,
          body: `x${i}`,
        });
        await s.apply(online, 'bob', i % 2 === 0);
        await s.elapse(10);
        await s.apply(online, 'bob', true);
      }
      await expectConverged(s);
      await expectLiveNoteAt(s, 'bob', `n-${seed}-7`, { body: 'x7' });
    }
  );
});
