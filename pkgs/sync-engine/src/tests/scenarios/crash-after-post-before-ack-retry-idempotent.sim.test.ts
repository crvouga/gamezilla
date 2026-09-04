import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  clientIds,
  crashAt,
  expectConverged,
  expectLiveNoteAt,
  expectNotesAgree,
  lastMutationOk,
  liveNotes,
  mutate,
  restart,
  setNote,
} from '../apps/acme';

describe('crash after post before ack retry idempotent', () => {
  test('crash after mutations POST accepted; restart re-drains idempotently', async () => {
    await using s = await acmeSystem.script({
      seed: 832,
      args: {
        clientCount: 0,
      },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });

    await s.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
    await expectConverged(s);

    await s.apply(crashAt, 'alice', 'afterNextMutationsPostAccepted');
    await s.apply(mutate, 'alice', setNote, {
      id: 'n1',
      body: 'post-accepted',
    });
    expect(await s.observe(lastMutationOk, 'alice')).toBe(true);
    await s.elapse(500);

    expect(await s.observe(clientIds)).not.toContain('alice');
    // Server applied before crash; client may re-upload on restart.
    await expectLiveNoteAt(s, 'server', 'n1', { body: 'post-accepted' });

    await s.apply(restart, 'alice', { preserveLocalDb: true });
    await expectConverged(s);

    const server = await s.observe(liveNotes, 'server');
    expect(server.filter((r) => r.id === 'n1').length).toBe(1);
    await expectLiveNoteAt(s, 'alice', 'n1', { body: 'post-accepted' });
    await expectLiveNoteAt(s, 'bob', 'n1', { body: 'post-accepted' });
    await expectNotesAgree(s, 'alice');
  });
});
