import { describe, test } from 'bun:test';
import {
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
  release,
  setNote,
  untilAcme,
} from '../apps/acme';

describe('live resend on reconnect vs drop', () => {
  test('default: missed live is dropped; sync pull repairs', async () => {
    await using s = await acmeSystem.script({
      seed: 601,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });
    await s.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
    await expectConverged(s);

    await s.apply(disconnect, 'bob');
    await s.apply(hold, 'bob', 'sync');
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'while-down' });
    await s.elapse(80);

    await s.apply(connect, 'bob');
    await neverAcme(s, (s) => liveNote(s, 'bob', 'n1'), { forMs: 200 });

    await s.apply(release, 'bob', 'sync');
    await expectConverged(s);
    await expectLiveNoteAt(s, 'bob', 'n1', { body: 'while-down' });
  });

  test('liveResendOnReconnect: consistent from resent live while sync held', async () => {
    await using s = await acmeSystem.script({
      seed: 602,
      args: { clientCount: 0, liveResendOnReconnect: true },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });
    await s.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
    await expectConverged(s);

    await s.apply(disconnect, 'bob');
    await s.apply(hold, 'bob', 'sync');
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'resent' });
    await s.elapse(80);

    await s.apply(connect, 'bob');
    await untilAcme(s, (s) => liveNote(s, 'bob', 'n1'), {
      maxMs: 2_000,
      pred: noteBodyIs('resent'),
    });
    await expectLiveNoteAt(s, 'bob', 'n1', { body: 'resent' });

    await s.apply(release, 'bob', 'sync');
    await expectConverged(s);
    await expectLiveNoteAt(s, 'bob', 'n1', { body: 'resent' });
  });
});
