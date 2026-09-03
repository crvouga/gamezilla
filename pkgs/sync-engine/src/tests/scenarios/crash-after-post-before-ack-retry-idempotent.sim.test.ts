import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeKnobs,
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
  passTime,
  restart,
  setNote,
  syncVirtualHost,
} from '../apps/acme';

describe('crash after post before ack retry idempotent', () => {
  test('crash after mutations POST accepted; restart re-drains idempotently', async () => {
    await using run = await start(acmeSystem, {
      seed: 832,
      host: syncVirtualHost(),
      knobs: acmeKnobs({
        clientCount: 0,
      }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });

    await run.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
    await expectConverged(run);

    await run.apply(crashAt, 'alice', 'afterNextMutationsPostAccepted');
    await run.apply(mutate, 'alice', setNote, {
      id: 'n1',
      body: 'post-accepted',
    });
    expect(await run.observe(lastMutationOk('alice'))).toBe(true);
    await run.apply(passTime, 500);

    expect(await run.observe(clientIds)).not.toContain('alice');
    // Server applied before crash; client may re-upload on restart.
    await expectLiveNoteAt(run, 'server', 'n1', { body: 'post-accepted' });

    await run.apply(restart, 'alice', { preserveLocalDb: true });
    await expectConverged(run);

    const server = await run.observe(liveNotes('server'));
    expect(server.filter((r) => r.id === 'n1').length).toBe(1);
    await expectLiveNoteAt(run, 'alice', 'n1', { body: 'post-accepted' });
    await expectLiveNoteAt(run, 'bob', 'n1', { body: 'post-accepted' });
    await expectNotesAgree(run, 'alice');
  });
});
