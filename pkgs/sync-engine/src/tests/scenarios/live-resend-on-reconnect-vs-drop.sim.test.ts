import { describe, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { expectLiveNote, isLiveNote, setNote } from '../apps/acme';
import { acmeSystem } from '../apps/acme/system';

describe('live resend on reconnect vs drop', () => {
  test('default: missed live is dropped; sync pull repairs', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 601,
      knobs: {
        clientCount: 0,
      },
    });
    const world = host.facade;
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await a.mutate(setNote, { id: 'warm', body: 'w' });
    await world.assertConverged();

    await b.disconnect();
    using _hold = world.net('bob', 'sync').set('hold');
    await a.mutate(setNote, { id: 'n1', body: 'while-down' });
    await world.runFor(80);

    await b.connect();
    await world.never(() => isLiveNote(b.db, 'n1'), { forMs: 200 });

    _hold.restore();
    await world.assertConverged();
    await expectLiveNote(b.db, 'n1', { body: 'while-down' });
  });

  test('liveResendOnReconnect: consistent from resent live while sync held', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 602,
      knobs: {
        clientCount: 0,
        liveResendOnReconnect: true,
      },
    });
    const world = host.facade;
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await a.mutate(setNote, { id: 'warm', body: 'w' });
    await world.assertConverged();

    await b.disconnect();
    using _hold = world.net('bob', 'sync').set('hold');
    await a.mutate(setNote, { id: 'n1', body: 'resent' });
    await world.runFor(80);

    await b.connect();
    await world.until(() => isLiveNote(b.db, 'n1'), { budgetMs: 2_000 });
    await expectLiveNote(b.db, 'n1', { body: 'resent' });

    _hold.restore();
    await world.assertConverged();
    await expectLiveNote(b.db, 'n1', { body: 'resent' });
  });
});
