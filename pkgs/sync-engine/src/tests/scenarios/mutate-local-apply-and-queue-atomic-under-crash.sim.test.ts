import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeDraws,
  acmeSystem,
  addClient,
  clientIds,
  crashAt,
  expectConverged,
  expectLiveNoteAt,
  expectNoteNotLiveAt,
  expectNotesAgree,
  lastMutationOk,
  liveNote,
  liveNotes,
  mutate,
  online,
  restart,
  setNote,
  syncVirtualHost,
} from '../apps/acme';

describe('mutate local apply and queue atomic under crash', () => {
  test('crash after mutate resolves offline: write everywhere or nowhere', async () => {
    await using run = await start(acmeSystem, {
      seed: 831,
      host: syncVirtualHost(),
      draws: acmeDraws({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });

    await run.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
    await expectConverged(run);

    await run.apply(online, 'alice', false);
    await run.apply(crashAt, 'alice', 'afterNextMutateResolved');
    await run.apply(mutate, 'alice', setNote, {
      id: 'atomic',
      body: 'queued-or-absent',
    });
    // Crash fires after mutate resolves — alice is gone from the run.
    expect(await run.observe(clientIds)).not.toContain('alice');
    expect(await run.observe(lastMutationOk('alice'))).toBe(true);

    await run.apply(restart, 'alice', { preserveLocalDb: true });
    await expectConverged(run);

    const onServer = (await run.observe(liveNotes('server'))).some(
      (r) => r.id === 'atomic' && r.body === 'queued-or-absent'
    );
    if (onServer) {
      await expectLiveNoteAt(run, 'alice', 'atomic', {
        body: 'queued-or-absent',
      });
      expect(await run.observe(liveNote('bob', 'atomic'))).toMatchObject({
        body: 'queued-or-absent',
      });
    } else {
      await expectNoteNotLiveAt(run, 'alice', 'atomic');
      await expectNoteNotLiveAt(run, 'bob', 'atomic');
    }
    await expectNotesAgree(run, 'alice');
    await expectNotesAgree(run, 'bob');
  });
});
