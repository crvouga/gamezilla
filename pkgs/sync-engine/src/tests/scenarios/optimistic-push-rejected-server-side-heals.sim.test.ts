import { describe, expect, test } from 'bun:test';
import {
  expectLiveNote,
  expectNotesMatchServer,
  serverRejectNote,
  setNote,
} from '../apps/acme';
import { openAcmeWorld } from '../apps/acme/system';

describe('optimistic push rejected server side heals', () => {
  test('optimistic live paint on peer heals to server truth after reject', async () => {
    await using world = await openAcmeWorld({
      seed: 810,
      knobs: {
        clientCount: 0,
        bufferOutboundLive: true,
      },
    });

    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.mutate(setNote, { id: 'n1', body: 'good' });
    await world.assertConverged();

    // Hold mutator sync so upload cannot ack; peer may still see optimistic.
    using holdAlice = world.net('alice', 'sync').set('hold');
    using holdBob = world.net('bob', 'sync').set('hold');
    const rejected = await a.mutate(serverRejectNote, {
      id: 'n1',
      body: 'bad-optimistic',
    });
    expect(rejected.ok).toBe(true);
    if (!rejected.ok) return;

    await world.advance(300);
    await expectLiveNote(b.db, 'n1', { body: 'bad-optimistic' });

    holdAlice.restore();
    await world.waitUntil(a.outcome(rejected.mutationId));
    expect((await a.rejections()).length).toBe(1);

    holdBob.restore();
    await b.mutate(setNote, { id: 'bump', body: 'x' });
    await world.assertConverged();

    await expectLiveNote(a.db, 'n1', { body: 'good' });
    await expectLiveNote(b.db, 'n1', { body: 'good' });
    await expectNotesMatchServer(a.db, world.server.db);
    await expectNotesMatchServer(b.db, world.server.db);
  });
});
