import { describe, expect, test } from 'bun:test';
import { openSimWorld } from '../../sim/world';
import {
  acmeDomainPack,
  deleteNote,
  expectLiveNote,
  expectNoteNotLive,
  expectNotesMatchServer,
  setNote,
  setNoteStrictExists,
} from '../apps/acme';

describe('rebase throw hidden until upload reject', () => {
  test('strict update hidden after peer delete; upload rejects; converge', async () => {
    await using world = await openSimWorld({
      domain: acmeDomainPack,
      seed: 821,
      rowImageFanout: false,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    // Bob owns the row so peer soft-delete is authorized.
    await b.mutate(setNote, { id: 'n1', body: 'seed' });
    await world.assertConverged();

    await a.disconnect();
    const pending = await a.mutate(setNoteStrictExists, {
      id: 'n1',
      body: 'strict-pending',
    });
    expect(pending.ok).toBe(true);
    if (!pending.ok) return;
    await expectLiveNote(a.db, 'n1', { body: 'strict-pending' });

    const del = await b.mutate(deleteNote, { id: 'n1' });
    expect(del.ok).toBe(true);
    await world.runFor(400);
    await expectNoteNotLive(world.server.db, 'n1');

    await a.connect();
    // Merge+rebase throws → optimistic effect hidden (tombstone wins locally).
    await world.until(async () => {
      try {
        await expectNoteNotLive(a.db, 'n1');
        return true;
      } catch {
        return false;
      }
    });
    await expectNoteNotLive(a.db, 'n1');

    await world.until(a.outcome(pending.mutationId));
    expect(await a.outcome(pending.mutationId)).toBe('rejected');
    const unacked = await a.rejections();
    expect(unacked.length).toBe(1);
    expect(unacked[0]?.mutationId).toBe(pending.mutationId);

    await b.mutate(setNote, { id: 'bump', body: 'x' });
    await world.assertConverged();
    await expectNoteNotLive(a.db, 'n1');
    await expectNotesMatchServer(a.db, world.server.db);
    await expectNotesMatchServer(b.db, world.server.db);
  });
});
