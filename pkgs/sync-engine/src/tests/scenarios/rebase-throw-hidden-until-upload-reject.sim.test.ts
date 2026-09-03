import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeDraws,
  acmeSystem,
  addClient,
  assertConverged,
  connect,
  deleteNote,
  disconnect,
  expectLiveNoteAt,
  expectNoteNotLiveAt,
  expectNotesAgree,
  lastMutationId,
  lastMutationOk,
  liveNote,
  mutate,
  noteNotLive,
  outcome,
  passTime,
  rejections,
  setNote,
  setNoteStrictExists,
  syncVirtualHost,
  untilAcme,
} from '../apps/acme';

describe('rebase throw hidden until upload reject', () => {
  test('strict update hidden after peer delete; upload rejects; converge', async () => {
    await using run = await start(acmeSystem, {
      seed: 821,
      host: syncVirtualHost(),
      draws: acmeDraws({
        clientCount: 0,
        rowImageFanout: false,
      }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });

    // Bob owns the row so peer soft-delete is authorized.
    await run.apply(mutate, 'bob', setNote, { id: 'n1', body: 'seed' });
    await run.apply(assertConverged);

    await run.apply(disconnect, 'alice');
    await run.apply(mutate, 'alice', setNoteStrictExists, {
      id: 'n1',
      body: 'strict-pending',
    });
    expect(await run.observe(lastMutationOk('alice'))).toBe(true);
    const pendingId = await run.observe(lastMutationId('alice'));
    expect(pendingId).not.toBeNull();
    if (pendingId === null) return;
    await expectLiveNoteAt(run, 'alice', 'n1', { body: 'strict-pending' });

    await run.apply(mutate, 'bob', deleteNote, { id: 'n1' });
    expect(await run.observe(lastMutationOk('bob'))).toBe(true);
    await run.apply(passTime, 400);
    await expectNoteNotLiveAt(run, 'server', 'n1');

    await run.apply(connect, 'alice');
    // Merge+rebase throws → optimistic effect hidden (tombstone wins locally).
    await untilAcme(run, liveNote('alice', 'n1'), { pred: noteNotLive });
    await expectNoteNotLiveAt(run, 'alice', 'n1');

    await untilAcme(run, outcome('alice', pendingId));
    expect(await run.observe(outcome('alice', pendingId))).toBe('rejected');
    const unacked = await run.observe(rejections('alice'));
    expect(unacked.length).toBe(1);
    expect(unacked[0]?.mutationId).toBe(pendingId);

    await run.apply(mutate, 'bob', setNote, { id: 'bump', body: 'x' });
    await run.apply(assertConverged);
    await expectNoteNotLiveAt(run, 'alice', 'n1');
    await expectNotesAgree(run, 'alice');
    await expectNotesAgree(run, 'bob');
  });
});
