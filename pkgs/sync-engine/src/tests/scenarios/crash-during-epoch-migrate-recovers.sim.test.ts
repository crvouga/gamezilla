import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import { SCHEMA_EPOCH } from '@pkgs/sync-engine/test';
import {
  acmeDraws,
  acmeSystem,
  addClient,
  assertConverged,
  clientIds,
  crashAt,
  disconnect,
  expectLiveNoteAt,
  expectNoteNotLiveAt,
  expectNotesAgree,
  mutate,
  passTime,
  restart,
  setNote,
  syncVirtualHost,
} from '../apps/acme';

describe('crash during epoch migrate recovers', () => {
  test('crash after cache wipe mid migrate; next boot drains pending', async () => {
    await using run = await start(acmeSystem, {
      seed: 834,
      host: syncVirtualHost(),
      draws: acmeDraws({
        clientCount: 0,
      }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });

    await run.apply(mutate, 'alice', setNote, {
      id: 'kept',
      body: 'on-server',
    });
    await run.apply(assertConverged);

    await run.apply(disconnect, 'alice');
    await run.apply(mutate, 'alice', setNote, {
      id: 'pending',
      body: 'durable',
    });
    await run.apply(passTime, 50);
    await expectLiveNoteAt(run, 'alice', 'pending', { body: 'durable' });
    await expectNoteNotLiveAt(run, 'server', 'pending');

    await run.apply(crashAt, 'alice', 'onNextEngineOpenAfterCacheWipe');
    await expect(
      run.apply(restart, 'alice', {
        preserveLocalDb: true,
        schemaEpoch: SCHEMA_EPOCH + 1,
      })
    ).rejects.toThrow(/crash during epoch migrate/);

    expect(await run.observe(clientIds)).not.toContain('alice');

    await run.apply(restart, 'alice', {
      preserveLocalDb: true,
      schemaEpoch: SCHEMA_EPOCH + 1,
    });
    await run.apply(assertConverged);

    await expectLiveNoteAt(run, 'alice', 'pending', { body: 'durable' });
    await expectLiveNoteAt(run, 'bob', 'pending', { body: 'durable' });
    await expectLiveNoteAt(run, 'alice', 'kept', { body: 'on-server' });
    await expectNotesAgree(run, 'alice');
  });
});
