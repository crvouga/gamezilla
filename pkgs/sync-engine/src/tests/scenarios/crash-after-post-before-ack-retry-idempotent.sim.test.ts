import { openWorld } from '@pkgs/determinism';
import { acmeSystem } from '../apps/acme/system';
import { syncFacade } from '../../sim/system';
import { describe, expect, test } from 'bun:test';
import { expectLiveNote, expectNotesMatchServer, readLiveNotes, setNote } from '../apps/acme';

describe('crash after post before ack retry idempotent', () => {
  test('crash after mutations POST accepted; restart re-drains idempotently', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 832,
      knobs: {
        clientCount: 0,
      },
    });
    const world = syncFacade(host.system);
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.mutate(setNote, { id: 'warm', body: 'w' });
    await world.assertConverged();

    using _arm = world.node('alice').crash({
      at: 'afterNextMutationsPostAccepted',
    });
    const queued = await a.mutate(setNote, {
      id: 'n1',
      body: 'post-accepted',
    });
    expect(queued.ok).toBe(true);
    await world.runFor(500);

    expect(world.clients.has('alice')).toBe(false);
    // Server applied before crash; client may re-upload on restart.
    await expectLiveNote(world.server.db, 'n1', { body: 'post-accepted' });

    const alice = await world.node('alice').restart({
      preserveLocalDb: true,
    });
    await world.assertConverged();

    const server = await readLiveNotes(world.server.db);
    expect(server.filter((r) => r.id === 'n1').length).toBe(1);
    await expectLiveNote(alice!.db, 'n1', { body: 'post-accepted' });
    await expectLiveNote(b.db, 'n1', { body: 'post-accepted' });
    await expectNotesMatchServer(alice!.db, world.server.db);
  });
});
