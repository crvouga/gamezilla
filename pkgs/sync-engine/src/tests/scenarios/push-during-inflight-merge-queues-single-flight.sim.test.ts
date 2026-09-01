import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { RELIABLE_FAULTS } from '../../sim/faults';
import { toKernelFaults } from '../../sim/network';
import { syncFacade } from '../../sim/system';
import {
  expectLiveNote,
  expectNotesMatchServer,
  readLiveNotes,
  setNote,
} from '../apps/acme';
import { acmeSystem } from '../apps/acme/system';

describe('push during inflight merge queues single flight', () => {
  test('pushes during merge leave no torn intermediate; final converge', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 811,
      knobs: {
        clientCount: 0,
      },
      networkDefaults: toKernelFaults({
        ...RELIABLE_FAULTS,
        oneWayDelayMeanMs: 30,
        oneWayDelayJitterMs: 20,
        reorderWindow: 3,
      }),
    });
    const world = syncFacade(host.system);
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.mutate(setNote, { id: 'n1', body: 'seed' });
    await a.mutate(setNote, { id: 'n2', body: 'seed' });
    await world.assertConverged();

    // nudge: force in-flight merge so pushes queue single-flight
    void b.nudge();
    await a.mutate(setNote, { id: 'n1', body: 'burst-1' });
    await a.mutate(setNote, { id: 'n2', body: 'burst-2' });
    await a.mutate(setNote, { id: 'n1', body: 'burst-final' });

    for (let i = 0; i < 12; i += 1) {
      await world.runFor(25);
      const rows = await readLiveNotes(b.db);
      // Single-flight: never a torn mix where only one of the seeded pair is gone.
      expect(rows.length).toBeGreaterThanOrEqual(2);
    }

    await world.assertConverged();
    await expectLiveNote(b.db, 'n1', { body: 'burst-final' });
    await expectLiveNote(b.db, 'n2', { body: 'burst-2' });
    await expectNotesMatchServer(b.db, world.server.db);
  });
});
