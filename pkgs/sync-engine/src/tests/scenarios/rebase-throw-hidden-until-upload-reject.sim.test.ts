import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  connect,
  deleteNote,
  disconnect,
  expectConverged,
  expectLiveNoteAt,
  expectNoteNotLiveAt,
  expectNotesAgree,
  lastMutationId,
  lastMutationOk,
  liveNote,
  mutate,
  noteNotLive,
  outcome,
  rejections,
  setNote,
  setNoteStrictExists,
  untilAcme,
} from '../apps/acme';

describe('rebase throw hidden until upload reject', () => {
  test('strict update hidden after peer delete; upload rejects; converge', async () => {
    await using s = await acmeSystem.script({
      seed: 821,
      args: {
        clientCount: 0,
        rowImageFanout: false,
      },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });

    // Bob owns the row so peer soft-delete is authorized.
    await s.apply(mutate, 'bob', setNote, { id: 'n1', body: 'seed' });
    await expectConverged(s);

    await s.apply(disconnect, 'alice');
    await s.apply(mutate, 'alice', setNoteStrictExists, {
      id: 'n1',
      body: 'strict-pending',
    });
    expect(await s.observe(lastMutationOk, 'alice')).toBe(true);
    const pendingId = await s.observe(lastMutationId, 'alice');
    expect(pendingId).not.toBeNull();
    if (pendingId === null) return;
    await expectLiveNoteAt(s, 'alice', 'n1', { body: 'strict-pending' });

    await s.apply(mutate, 'bob', deleteNote, { id: 'n1' });
    expect(await s.observe(lastMutationOk, 'bob')).toBe(true);
    await s.elapse(400);
    await expectNoteNotLiveAt(s, 'server', 'n1');

    await s.apply(connect, 'alice');
    // Merge+rebase throws → optimistic effect hidden (tombstone wins locally).
    await untilAcme(s, (s) => liveNote(s, 'alice', 'n1'), {
      pred: noteNotLive,
    });
    await expectNoteNotLiveAt(s, 'alice', 'n1');

    await untilAcme(s, (s) => outcome(s, 'alice', pendingId));
    expect(await s.observe(outcome, 'alice', pendingId)).toBe('rejected');
    const unacked = await s.observe(rejections, 'alice');
    expect(unacked.length).toBe(1);
    expect(unacked[0]?.mutationId).toBe(pendingId);

    await s.apply(mutate, 'bob', setNote, { id: 'bump', body: 'x' });
    await expectConverged(s);
    await expectNoteNotLiveAt(s, 'alice', 'n1');
    await expectNotesAgree(s, 'alice');
    await expectNotesAgree(s, 'bob');
  });
});
