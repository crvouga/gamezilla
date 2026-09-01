import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { SCHEMA_EPOCH } from '@pkgs/sync-engine/test';
import {
  expectLiveNote,
  expectNoteNotLive,
  expectNotesMatchServer,
  setNote,
} from '../apps/acme';
import { acmeSystem } from '../apps/acme/system';

describe('crash during epoch migrate recovers', () => {
  test('crash after cache wipe mid migrate; next boot drains pending', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 834,
      knobs: {
        clientCount: 0,
      },
    });
    const world = host.facade;
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.mutate(setNote, { id: 'kept', body: 'on-server' });
    await world.assertConverged();

    await a.disconnect();
    await a.mutate(setNote, { id: 'pending', body: 'durable' });
    await world.runFor(50);
    await expectLiveNote(a.db, 'pending', { body: 'durable' });
    await expectNoteNotLive(world.server.db, 'pending');

    using _arm = world.node('alice').crash({
      at: 'onNextEngineOpenAfterCacheWipe',
    });
    await expect(
      world.node('alice').restart({
        preserveLocalDb: true,
        schemaEpoch: SCHEMA_EPOCH + 1,
      })
    ).rejects.toThrow(/crash during epoch migrate/);

    expect(world.clients.has('alice')).toBe(false);

    const alice = await world.node('alice').restart({
      preserveLocalDb: true,
      schemaEpoch: SCHEMA_EPOCH + 1,
    });
    await world.assertConverged();

    await expectLiveNote(alice!.db, 'pending', { body: 'durable' });
    await expectLiveNote(b.db, 'pending', { body: 'durable' });
    await expectLiveNote(alice!.db, 'kept', { body: 'on-server' });
    await expectNotesMatchServer(alice!.db, world.server.db);
  });
});
