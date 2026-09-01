import { openWorld } from '@pkgs/determinism';
import { acmeSystem } from '../apps/acme/system';
import { syncFacade } from '../../sim/system';
import { describe, expect, test } from 'bun:test';
import { acknowledgeWriteRejectionMutation, expectLiveNote, expectNotesMatchServer, serverRejectNote, setNote } from '../apps/acme';

describe('permanent reject stored peer never applies', () => {
  test('server reject stores write_rejection and merge restores domain', async () => {
    // rowImageFanout off: rejected optimistic body must not poison peers.
    await using host = await openWorld(acmeSystem, {
      seed: 501,
      knobs: {
        clientCount: 0,
        rowImageFanout: false,
      },
    });
    const world = syncFacade(host.system);
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.mutate(setNote, { id: 'n1', body: 'good' });
    await world.assertConverged();

    const rejected = await a.mutate(serverRejectNote, {
      id: 'n1',
      body: 'bad',
    });
    expect(rejected.ok).toBe(true);
    if (!rejected.ok) return;

    await world.until(a.outcome(rejected.mutationId));
    expect(await a.outcome(rejected.mutationId)).toBe('rejected');

    const unacked = await a.rejections();
    expect(unacked.length).toBe(1);
    expect(unacked[0]?.code).toBe('FORBIDDEN');
    expect(unacked[0]?.mutationId).toBe(rejected.mutationId);

    // Peer never applied the rejected body.
    await expectLiveNote(b.db, 'n1', { body: 'good' });

    // not_modified would leave alice's optimistic body; bump server hash.
    await b.mutate(setNote, { id: 'bump', body: 'x' });
    await world.assertConverged();
    await expectLiveNote(a.db, 'n1', { body: 'good' });
    await expectNotesMatchServer(a.db, world.server.db);
    await expectNotesMatchServer(b.db, world.server.db);

    const ack = await a.mutate(acknowledgeWriteRejectionMutation, {
      rejectionId: unacked[0]!.id,
    });
    expect(ack.ok).toBe(true);
    if (!ack.ok) return;
    await world.until(a.outcome(ack.mutationId));
    expect(await a.outcome(ack.mutationId)).toBe('confirmed');
    expect(await a.rejections()).toEqual([]);
  });
});
