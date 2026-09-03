import { describe, test } from 'bun:test';
import { script } from '@pkgs/dst';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  connect,
  disconnect,
  expectConverged,
  expectLiveNoteAt,
  hold,
  liveNote,
  mutate,
  neverAcme,
  noteBodyIs,
  passTime,
  release,
  setNote,
  syncVirtualHost,
  untilAcme,
} from '../apps/acme';

describe('live resend on reconnect vs drop', () => {
  test('default: missed live is dropped; sync pull repairs', async () => {
    await using run = await script(acmeSystem, {
      seed: 601,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });
    await run.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
    await expectConverged(run);

    await run.apply(disconnect, 'bob');
    await run.apply(hold, 'bob', 'sync');
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'while-down' });
    await run.apply(passTime, 80);

    await run.apply(connect, 'bob');
    await neverAcme(run, liveNote('bob', 'n1'), { forMs: 200 });

    await run.apply(release, 'bob', 'sync');
    await expectConverged(run);
    await expectLiveNoteAt(run, 'bob', 'n1', { body: 'while-down' });
  });

  test('liveResendOnReconnect: consistent from resent live while sync held', async () => {
    await using run = await script(acmeSystem, {
      seed: 602,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0, liveResendOnReconnect: true }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });
    await run.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
    await expectConverged(run);

    await run.apply(disconnect, 'bob');
    await run.apply(hold, 'bob', 'sync');
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'resent' });
    await run.apply(passTime, 80);

    await run.apply(connect, 'bob');
    await untilAcme(run, liveNote('bob', 'n1'), {
      maxMs: 2_000,
      pred: noteBodyIs('resent'),
    });
    await expectLiveNoteAt(run, 'bob', 'n1', { body: 'resent' });

    await run.apply(release, 'bob', 'sync');
    await expectConverged(run);
    await expectLiveNoteAt(run, 'bob', 'n1', { body: 'resent' });
  });
});
