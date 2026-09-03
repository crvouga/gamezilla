import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  expectConverged,
  illegalHardDeleteNote,
  lastMutationFailures,
  lastMutationOk,
  liveNote,
  mutate,
  setNote,
  syncVirtualHost,
} from '../apps/acme';

describe('domain hard delete rejected', () => {
  test('illegalHardDeleteNote fails with NO_HARD_DELETE; row stays live', async () => {
    await using run = await start(acmeSystem, {
      seed: 60,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'keep-me' });
    await expectConverged(run);

    await run.apply(mutate, 'alice', illegalHardDeleteNote, { id: 'n1' });
    expect(await run.observe(lastMutationOk('alice'))).toBe(false);
    expect(await run.observe(lastMutationFailures('alice'))).toContain(
      'NO_HARD_DELETE'
    );

    expect(await run.observe(liveNote('alice', 'n1'))).toMatchObject({
      body: 'keep-me',
    });
    expect(await run.observe(liveNote('server', 'n1'))).toMatchObject({
      body: 'keep-me',
    });
  });
});
