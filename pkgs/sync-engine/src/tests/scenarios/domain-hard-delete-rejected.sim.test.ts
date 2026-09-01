import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { syncFacade } from '../../sim/system';
import {
  expectLiveNote,
  illegalHardDeleteNote,
  readLiveNotes,
  setNote,
} from '../apps/acme';
import { acmeSystem } from '../apps/acme/system';

describe('domain hard delete rejected', () => {
  test('illegalHardDeleteNote fails with NO_HARD_DELETE; row stays live', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 60,
      knobs: {
        clientCount: 0,
      },
    });
    const world = syncFacade(host.state);
    const a = await world.addClient({ id: 'alice' });
    await a.mutate(setNote, { id: 'n1', body: 'keep-me' });
    await world.assertConverged();

    const result = await a.mutate(illegalHardDeleteNote, { id: 'n1' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failures.some((f) => f.code === 'NO_HARD_DELETE')).toBe(
        true
      );
    }

    await expectLiveNote(a.db, 'n1', { body: 'keep-me' });
    const server = await readLiveNotes(world.server.db);
    expect(server.find((r) => r.id === 'n1')?.body).toBe('keep-me');
  });
});
