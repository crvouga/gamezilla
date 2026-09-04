import { describe, expect, test } from 'bun:test';
import {
  addClient,
  exampleSystem,
  expectInSync,
  illegalHardDeleteNote,
  lastMutationFailures,
  lastMutationOk,
  liveNote,
  mutate,
  setNote,
} from '@pkgs/sync-engine/sim';

describe('domain hard delete rejected', () => {
  test('illegalHardDeleteNote fails with NO_HARD_DELETE; row stays live', async () => {
    await using s = await exampleSystem.run({
      seed: 60,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'keep-me' });
    await expectInSync(s);

    await s.apply(mutate, 'alice', illegalHardDeleteNote, { id: 'n1' });
    expect(await s.read(lastMutationOk, 'alice')).toBe(false);
    expect(await s.read(lastMutationFailures, 'alice')).toContain(
      'NO_HARD_DELETE'
    );

    expect(await s.read(liveNote, 'alice', 'n1')).toMatchObject({
      body: 'keep-me',
    });
    expect(await s.read(liveNote, 'server', 'n1')).toMatchObject({
      body: 'keep-me',
    });
  });
});
