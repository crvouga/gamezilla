import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeDraws,
  acmeMutationRegistry,
  acmeSystem,
  addClient,
  expectConverged,
  liveNote,
  liveNotes,
  mutate,
  setNote,
  setNoteV2,
  syncVirtualHost,
} from '../apps/acme';

/** Old-client registry: setNoteV2 not registered locally (server still has both). */
function mutationRegistryV1Only(): typeof acmeMutationRegistry {
  return Object.fromEntries(
    Object.entries(acmeMutationRegistry).filter(
      ([name]) => name !== 'setNoteV2'
    )
  ) as typeof acmeMutationRegistry;
}

describe('set note v1 v2 interleaved converge', () => {
  test('setNote and setNoteV2 interleaved writes converge', async () => {
    await using run = await start(acmeSystem, {
      seed: 660,
      host: syncVirtualHost(),
      draws: acmeDraws({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });

    await run.apply(mutate, 'alice', setNote, { id: 'shared', body: 'v1-a' });
    await run.apply(mutate, 'bob', setNoteV2, { id: 'shared', body: 'v2-b' });
    await run.apply(mutate, 'alice', setNote, {
      id: 'only-a',
      body: 'from-v1',
    });
    await run.apply(mutate, 'bob', setNoteV2, {
      id: 'only-b',
      body: 'from-v2',
    });
    await expectConverged(run);

    expect(await run.observe(liveNote('alice', 'only-a'))).toMatchObject({
      body: 'from-v1',
    });
    expect(await run.observe(liveNote('bob', 'only-b'))).toMatchObject({
      body: 'from-v2',
    });
    const shared = (await run.observe(liveNotes('server'))).find(
      (r) => r.id === 'shared'
    );
    expect(shared?.body === 'v1-a' || shared?.body === 'v2-b').toBe(true);
  });

  test('mutation-v2-rollout-old-client-still-replays-v1', async () => {
    await using run = await start(acmeSystem, {
      seed: 661,
      host: syncVirtualHost(),
      draws: acmeDraws({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, {
      id: 'alice',
      mutationRegistry: mutationRegistryV1Only(),
    });
    await run.apply(addClient, { id: 'bob' });

    await run.apply(mutate, 'alice', setNote, {
      id: 'from-old',
      body: 'v1-only-client',
    });
    await run.apply(mutate, 'bob', setNoteV2, {
      id: 'from-new',
      body: 'v2-peer',
    });
    await expectConverged(run);

    expect(await run.observe(liveNote('alice', 'from-old'))).toMatchObject({
      body: 'v1-only-client',
    });
    expect(await run.observe(liveNote('alice', 'from-new'))).toMatchObject({
      body: 'v2-peer',
    });
    expect(await run.observe(liveNote('bob', 'from-old'))).toMatchObject({
      body: 'v1-only-client',
    });
  });
});
