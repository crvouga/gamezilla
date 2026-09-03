import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeKnobs,
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
  syncVirtualHost,
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
      await using run = await start(acmeSystem, {
        seed,
        host: syncVirtualHost(),
        knobs: acmeKnobs({ clientCount: 0 }),
        properties: [],
      });

      await run.apply(addClient, 'alice');
      await run.apply(addClient, 'bob');

      // Seed so reject heals via snapshot (absence ≠ delete for new ids).
      await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'seed' });
      await expectConverged(run);

      await run.apply(disconnect, 'alice');
      await run.apply(mutate, 'alice', setNote, {
        id: 'n1',
        body: 'will-reject',
      });
      const mutationId = await run.observe(lastMutationId('alice'));
      expect(mutationId).not.toBeNull();
      if (mutationId === null) return;

      await run.apply(runSql, 'alice', corruptArgs(mutationId));

      await run.apply(connect, 'alice');
      await untilAcme(run, outcome('alice', mutationId), { maxMs: 5_000 });
      expect(await run.observe(outcome('alice', mutationId))).toBe('rejected');

      const unacked = await run.observe(rejections('alice'));
      expect(unacked.some((r) => r.mutationId === mutationId)).toBe(true);
      expect(unacked.some((r) => r.code === 'INVALID_ARGS')).toBe(true);

      await expectLiveNoteAt(run, 'server', 'n1', { body: 'seed' });
      await expectLiveNoteAt(run, 'bob', 'n1', { body: 'seed' });

      // Bump server hash so alice's optimistic body is overwritten.
      await run.apply(mutate, 'bob', setNote, { id: 'ok', body: 'healthy' });
      await expectConverged(run);
      await expectLiveNoteAt(run, 'alice', 'n1', { body: 'seed' });
      await expectLiveNoteAt(run, 'alice', 'ok', { body: 'healthy' });
      await expectNotesAgree(run, 'alice');
    }
  );

  test('brand-new note with corrupt queued args tombstones after reject', async () => {
    await using run = await start(acmeSystem, {
      seed: 2143,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');

    await run.apply(disconnect, 'alice');
    await run.apply(mutate, 'alice', setNote, {
      id: 'orphan',
      body: 'will-reject',
    });
    const mutationId = await run.observe(lastMutationId('alice'));
    expect(mutationId).not.toBeNull();
    if (mutationId === null) return;

    await run.apply(runSql, 'alice', corruptArgs(mutationId));

    await run.apply(connect, 'alice');
    await untilAcme(run, outcome('alice', mutationId), { maxMs: 5_000 });
    expect(await run.observe(outcome('alice', mutationId))).toBe('rejected');

    await run.apply(mutate, 'bob', setNote, { id: 'ok', body: 'healthy' });
    await expectConverged(run);
    await expectNoteNotLiveAt(run, 'alice', 'orphan');
    await expectLiveNoteAt(run, 'alice', 'ok', { body: 'healthy' });
    await expectNotesAgree(run, 'alice');
  });
});
