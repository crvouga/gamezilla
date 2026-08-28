import { describe, expect, test } from 'bun:test';
import { openSimWorld } from '../../sim/world';
import {
  acmeDomainPack,
  expectLiveNote,
  illegalHardDeleteNote,
  readLiveNotes,
  setNote,
} from '../apps/acme';

describe('domain hard delete rejected', () => {
  test('illegalHardDeleteNote fails with NO_HARD_DELETE; row stays live', async () => {
    await using world = await openSimWorld({
      domain: acmeDomainPack,
      seed: 60,
    });
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
