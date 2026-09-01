import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { syncFacade } from '../../sim/system';
import {
  expectLiveNote,
  readLiveFolders,
  readLiveNotes,
  setNote,
} from '../apps/acme';
import { acmeSystem } from '../apps/acme/system';

describe('empty tables and zero row snapshot', () => {
  test('zero-row world converges; not_modified refresh stays empty', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 1020,
      knobs: {
        clientCount: 0,
      },
    });
    const world = syncFacade(host.state);
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await world.assertConverged();
    expect(await readLiveNotes(a.db)).toEqual([]);
    expect(await readLiveFolders(a.db)).toEqual([]);
    expect(await readLiveNotes(b.db)).toEqual([]);

    // nudge: verify not_modified refresh stays empty
    await world.until(a.nudge());
    // nudge: peer not_modified refresh stays empty
    await world.until(b.nudge());
    expect(await readLiveNotes(a.db)).toEqual([]);
    await world.assertConverged();
  });

  test('absence in snapshot does not delete unrelated live rows outside scope', async () => {
    // Pin upsert contract: empty secondary scope refresh must not wipe domain.
    await using host = await openWorld(acmeSystem, {
      seed: 1021,
      knobs: {
        clientCount: 0,
      },
    });
    const world = syncFacade(host.state);
    const a = await world.addClient({ id: 'alice' });
    await world.addClient({ id: 'bob' });
    await a.mutate(setNote, { id: 'keep', body: 'seed' });
    await world.assertConverged();

    {
      using denied = a.subscribe('notesDenied', {});
      await world.until(denied.ready);
      await expectLiveNote(a.db, 'keep', { body: 'seed' });
    }
    // nudge: post-unsubscribe refresh must keep unrelated live rows
    await world.until(a.nudge());
    await expectLiveNote(a.db, 'keep', { body: 'seed' });
    await world.assertConverged();
  });

  test.each([1022, 1023, 1024])(
    'seed sweep empty converge (seed=%i)',
    async (seed) => {
      await using host = await openWorld(acmeSystem, {
        seed: seed,
        knobs: {
          clientCount: 0,
        },
      });
      const world = syncFacade(host.state);
      await world.addClient({ id: 'alice' });
      await world.addClient({ id: 'bob' });
      await world.assertConverged();
      expect(await readLiveNotes(world.server.db)).toEqual([]);
    }
  );
});
