import { describe, test } from 'bun:test';
import {
  expectLiveNote,
  expectNotesMatchServer,
  acmeDomainPack,
  setNote,
} from '../apps/acme';
import { openSimWorld } from '../../sim/world';

describe('server crash mid request client retries', () => {
  test('server dies mid traffic; restart; clients retry and converge', async () => {
    await using world = await openSimWorld({
      domain: acmeDomainPack,
      seed: 833,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.mutate(setNote, { id: 'warm', body: 'w' });
    await world.assertConverged();

    {
      using _hold = world.net('alice', 'sync').set('hold');
      const pending = a.mutate(setNote, { id: 'n1', body: 'during-crash' });
      await world.runFor(20);
      await world.node('server').crash();
      await world.runFor(50);
      await world.node('server').restart({ preserveLocalDb: true });
      void pending;
    }
    await world.assertConverged();

    await expectLiveNote(b.db, 'n1', { body: 'during-crash' });
    await expectNotesMatchServer(a.db, world.server.db);
    await expectNotesMatchServer(b.db, world.server.db);

    // Query path also recovers after server restart.
    await b.mutate(setNote, { id: 'n2', body: 'after-restart' });
    await world.assertConverged();
    await expectLiveNote(a.db, 'n2', { body: 'after-restart' });
  });
});
