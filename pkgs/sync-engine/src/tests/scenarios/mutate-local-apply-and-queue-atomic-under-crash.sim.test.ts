import { describe, expect, test } from 'bun:test';
import {
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
} from '../apps/acme';

describe('mutate local apply and queue atomic under crash', () => {
  test('crash after mutate resolves offline: write everywhere or nowhere', async () => {
    await using s = await acmeSystem.script({
      seed: 831,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });

    await s.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
    await expectConverged(s);

    await s.apply(online, 'alice', false);
    await s.apply(crashAt, 'alice', 'afterNextMutateResolved');
    await s.apply(mutate, 'alice', setNote, {
      id: 'atomic',
      body: 'queued-or-absent',
    });
    // Crash fires after mutate resolves — alice is gone from the run.
    expect(await s.observe(clientIds)).not.toContain('alice');
    expect(await s.observe(lastMutationOk, 'alice')).toBe(true);

    await s.apply(restart, 'alice', { preserveLocalDb: true });
    await expectConverged(s);

    const onServer = (await s.observe(liveNotes, 'server')).some(
      (r) => r.id === 'atomic' && r.body === 'queued-or-absent'
    );
    if (onServer) {
      await expectLiveNoteAt(s, 'alice', 'atomic', {
        body: 'queued-or-absent',
      });
      expect(await s.observe(liveNote, 'bob', 'atomic')).toMatchObject({
        body: 'queued-or-absent',
      });
    } else {
      await expectNoteNotLiveAt(s, 'alice', 'atomic');
      await expectNoteNotLiveAt(s, 'bob', 'atomic');
    }
    await expectNotesAgree(s, 'alice');
    await expectNotesAgree(s, 'bob');
  });
});
