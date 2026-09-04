import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  connect,
  disconnect,
  expectConverged,
  lastMutationId,
  mutate,
  outcome,
  rejections,
  runSql,
  setNote,
  untilAcme,
} from '../apps/acme';
import {
  expectLiveNoteAt,
  expectNoteNotLiveAt,
  expectNotesAgree,
} from '../apps/acme/reads';

/** Replace a queued mutation's args with a non-JSON blob. */
function corruptArgs(mutationId: string): string {
  return `UPDATE sync_engine_mutations SET args = '__not_json__' WHERE id = '${mutationId}'`;
}

describe('corrupt queued args permanent reject', () => {
  test.each([2140, 2141, 2142])(
    'non-json queued args reject permanently; healthy mutate drains (seed=%i)',
    async (seed) => {
      await using s = await acmeSystem.script({
        seed,
        args: { clientCount: 0 },
      });

      await s.apply(addClient, 'alice');
      await s.apply(addClient, 'bob');

      // Seed so reject heals via snapshot (absence ≠ delete for new ids).
      await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'seed' });
      await expectConverged(s);

      await s.apply(disconnect, 'alice');
      await s.apply(mutate, 'alice', setNote, {
        id: 'n1',
        body: 'will-reject',
      });
      const mutationId = await s.observe(lastMutationId, 'alice');
      expect(mutationId).not.toBeNull();
      if (mutationId === null) return;

      await s.apply(runSql, 'alice', corruptArgs(mutationId));

      await s.apply(connect, 'alice');
      await untilAcme(s, (s) => outcome(s, 'alice', mutationId), {
        maxMs: 5_000,
      });
      expect(await s.observe(outcome, 'alice', mutationId)).toBe('rejected');

      const unacked = await s.observe(rejections, 'alice');
      expect(unacked.some((r) => r.mutationId === mutationId)).toBe(true);
      expect(unacked.some((r) => r.code === 'INVALID_ARGS')).toBe(true);

      await expectLiveNoteAt(s, 'server', 'n1', { body: 'seed' });
      await expectLiveNoteAt(s, 'bob', 'n1', { body: 'seed' });

      // Bump server hash so alice's optimistic body is overwritten.
      await s.apply(mutate, 'bob', setNote, { id: 'ok', body: 'healthy' });
      await expectConverged(s);
      await expectLiveNoteAt(s, 'alice', 'n1', { body: 'seed' });
      await expectLiveNoteAt(s, 'alice', 'ok', { body: 'healthy' });
      await expectNotesAgree(s, 'alice');
    }
  );

  test('brand-new note with corrupt queued args tombstones after reject', async () => {
    await using s = await acmeSystem.script({
      seed: 2143,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');

    await s.apply(disconnect, 'alice');
    await s.apply(mutate, 'alice', setNote, {
      id: 'orphan',
      body: 'will-reject',
    });
    const mutationId = await s.observe(lastMutationId, 'alice');
    expect(mutationId).not.toBeNull();
    if (mutationId === null) return;

    await s.apply(runSql, 'alice', corruptArgs(mutationId));

    await s.apply(connect, 'alice');
    await untilAcme(s, (s) => outcome(s, 'alice', mutationId), {
      maxMs: 5_000,
    });
    expect(await s.observe(outcome, 'alice', mutationId)).toBe('rejected');

    await s.apply(mutate, 'bob', setNote, { id: 'ok', body: 'healthy' });
    await expectConverged(s);
    await expectNoteNotLiveAt(s, 'alice', 'orphan');
    await expectLiveNoteAt(s, 'alice', 'ok', { body: 'healthy' });
    await expectNotesAgree(s, 'alice');
  });
});
