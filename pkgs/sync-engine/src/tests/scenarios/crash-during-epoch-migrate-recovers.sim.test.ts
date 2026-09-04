import { describe, expect, test } from 'bun:test';
import { SCHEMA_EPOCH } from '@pkgs/sync-engine/test';
import {
  acmeSystem,
  addClient,
  clientIds,
  crashAt,
  disconnect,
  expectConverged,
  expectLiveNoteAt,
  expectNoteNotLiveAt,
  expectNotesAgree,
  mutate,
  restart,
  setNote,
} from '../apps/acme';

describe('crash during epoch migrate recovers', () => {
  test('crash after cache wipe mid migrate; next boot drains pending', async () => {
    await using s = await acmeSystem.script({
      seed: 834,
      args: {
        clientCount: 0,
      },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });

    await s.apply(mutate, 'alice', setNote, {
      id: 'kept',
      body: 'on-server',
    });
    await expectConverged(s);

    await s.apply(disconnect, 'alice');
    await s.apply(mutate, 'alice', setNote, {
      id: 'pending',
      body: 'durable',
    });
    await s.elapse(50);
    await expectLiveNoteAt(s, 'alice', 'pending', { body: 'durable' });
    await expectNoteNotLiveAt(s, 'server', 'pending');

    await s.apply(crashAt, 'alice', 'onNextEngineOpenAfterCacheWipe');
    await expect(
      s.apply(restart, 'alice', {
        preserveLocalDb: true,
        schemaEpoch: SCHEMA_EPOCH + 1,
      })
    ).rejects.toThrow(/crash during epoch migrate/);

    expect(await s.observe(clientIds)).not.toContain('alice');

    await s.apply(restart, 'alice', {
      preserveLocalDb: true,
      schemaEpoch: SCHEMA_EPOCH + 1,
    });
    await expectConverged(s);

    await expectLiveNoteAt(s, 'alice', 'pending', { body: 'durable' });
    await expectLiveNoteAt(s, 'bob', 'pending', { body: 'durable' });
    await expectLiveNoteAt(s, 'alice', 'kept', { body: 'on-server' });
    await expectNotesAgree(s, 'alice');
  });
});
