import { openWorld } from '@pkgs/determinism';
import { acmeSystem } from '../apps/acme/system';
import { syncFacade } from '../../sim/system';
import { describe, expect, test } from 'bun:test';
import { expectLiveNote, isLiveNote, setNote } from '../apps/acme';

describe('background pauses sweeps foreground catches up', () => {
  test('background pauses query sweeps until foreground', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 507,
      knobs: {
        clientCount: 0,
        rowImageFanout: false,
      },
    });
    const world = syncFacade(host.system);
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await a.mutate(setNote, { id: 'warm', body: 'w' });
    await world.assertConverged();

    b.foreground(false);
    await a.mutate(setNote, { id: 'n1', body: 'while-bg' });
    await world.never(() => isLiveNote(b.db, 'n1'), { forMs: 300 });

    b.foreground(true);
    await world.until(async () => isLiveNote(b.db, 'n1'));
    await world.assertConverged();
    await expectLiveNote(b.db, 'n1', { body: 'while-bg' });
  });

  test('background does not block local mutate visibility', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 508,
      knobs: {
        clientCount: 0,
      },
    });
    const world = syncFacade(host.system);
    const a = await world.addClient({ id: 'alice' });
    a.foreground(false);
    const ok = await a.mutate(setNote, { id: 'local', body: 'bg-write' });
    expect(ok.ok).toBe(true);
    await expectLiveNote(a.db, 'local', { body: 'bg-write' });
    // Drain upload while pumping sim time (dispose awaits upload stop).
    a.foreground(true);
    await world.runFor(200);
  });
});
