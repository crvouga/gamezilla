import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { syncFacade } from '../../sim/system';
import { expectLiveNote, readLiveNotes, setNote } from '../apps/acme';
import { acmeSystem } from '../apps/acme/system';

const STORM = 150;

describe('mutation storm batching order preserved', () => {
  test('offline queue drains; last-write-wins body matches seq order', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 1060,
      knobs: {
        clientCount: 0,
      },
    });
    const world = syncFacade(host.system);
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.disconnect();
    // Many updates to the same id — final body must be last mutate.
    for (let i = 0; i < STORM; i += 1) {
      await a.mutate(setNote, {
        id: 'storm-shared',
        body: `v${i}`,
      });
    }
    // Distinct ids preserve create order / full set.
    for (let i = 0; i < 40; i += 1) {
      await a.mutate(setNote, {
        id: `row-${String(i).padStart(3, '0')}`,
        body: `r${i}`,
      });
    }

    await a.connect();
    await world.assertConverged();

    await expectLiveNote(b.db, 'storm-shared', { body: `v${STORM - 1}` });
    await expectLiveNote(world.server.db, 'storm-shared', {
      body: `v${STORM - 1}`,
    });
    const server = await readLiveNotes(world.server.db);
    expect(server.some((n) => n.id === 'row-000')).toBe(true);
    expect(server.some((n) => n.id === 'row-039')).toBe(true);
    await expectLiveNote(b.db, 'row-039', { body: 'r39' });
  });

  test.each([1061, 1062, 1063])(
    'seed sweep modest storm preserves final body (seed=%i)',
    async (seed) => {
      await using host = await openWorld(acmeSystem, {
        seed: seed,
        knobs: {
          clientCount: 0,
        },
      });
      const world = syncFacade(host.system);
      const a = await world.addClient({ id: 'alice' });
      await world.addClient({ id: 'bob' });
      await a.disconnect();
      for (let i = 0; i < 30; i += 1) {
        await a.mutate(setNote, { id: `s-${seed}`, body: `v${i}` });
      }
      await a.connect();
      await world.assertConverged();
      await expectLiveNote(world.server.db, `s-${seed}`, { body: 'v29' });
    }
  );
});
