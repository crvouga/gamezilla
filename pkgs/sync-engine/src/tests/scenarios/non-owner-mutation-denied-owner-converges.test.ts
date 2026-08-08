import { describe, expect, test } from 'bun:test';
import {
  deleteNote,
  expectLiveNote,
  expectNoteNotLive,
  notesDomainPack,
  setNote,
} from '../../domain-packs/notes-app';
import { openSimWorld } from '../../sim/world';

describe('non owner mutation denied owner converges', () => {
  test('non-owner delete is rejected; note stays live on peers', async () => {
    await using world = await openSimWorld({
      domain: notesDomainPack,
      seed: 50,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.mutate(setNote, { id: 'n1', body: 'owned-by-alice' });
    await world.assertConverged();

    const denied = await b.mutate(deleteNote, { id: 'n1' });
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.failures.some((f) => f.code === 'FORBIDDEN')).toBe(true);
    }

    await world.assertConverged();
    await expectLiveNote(a.db, 'n1', { body: 'owned-by-alice' });
    await expectLiveNote(b.db, 'n1', { body: 'owned-by-alice' });
  });

  test('owner delete succeeds', async () => {
    await using world = await openSimWorld({
      domain: notesDomainPack,
      seed: 51,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await a.mutate(setNote, { id: 'n1', body: 'x' });
    await world.assertConverged();
    const ok = await a.mutate(deleteNote, { id: 'n1' });
    expect(ok.ok).toBe(true);
    await world.assertConverged();
    await expectNoteNotLive(b.db, 'n1');
  });
});
