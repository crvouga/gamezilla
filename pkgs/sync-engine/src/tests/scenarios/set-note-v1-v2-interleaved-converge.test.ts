import { describe, expect, test } from 'bun:test';
import {
  acmeMutationRegistry,
  acmeSystem,
  addClient,
  expectConverged,
  liveNote,
  liveNotes,
  mutate,
  setNote,
  setNoteV2,
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
    await using s = await acmeSystem.script({
      seed: 660,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });

    await s.apply(mutate, 'alice', setNote, { id: 'shared', body: 'v1-a' });
    await s.apply(mutate, 'bob', setNoteV2, { id: 'shared', body: 'v2-b' });
    await s.apply(mutate, 'alice', setNote, {
      id: 'only-a',
      body: 'from-v1',
    });
    await s.apply(mutate, 'bob', setNoteV2, {
      id: 'only-b',
      body: 'from-v2',
    });
    await expectConverged(s);

    expect(await s.observe(liveNote, 'alice', 'only-a')).toMatchObject({
      body: 'from-v1',
    });
    expect(await s.observe(liveNote, 'bob', 'only-b')).toMatchObject({
      body: 'from-v2',
    });
    const shared = (await s.observe(liveNotes, 'server')).find(
      (r) => r.id === 'shared'
    );
    expect(shared?.body === 'v1-a' || shared?.body === 'v2-b').toBe(true);
  });

  test('mutation-v2-rollout-old-client-still-replays-v1', async () => {
    await using s = await acmeSystem.script({
      seed: 661,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, {
      id: 'alice',
      mutationRegistry: mutationRegistryV1Only(),
    });
    await s.apply(addClient, { id: 'bob' });

    await s.apply(mutate, 'alice', setNote, {
      id: 'from-old',
      body: 'v1-only-client',
    });
    await s.apply(mutate, 'bob', setNoteV2, {
      id: 'from-new',
      body: 'v2-peer',
    });
    await expectConverged(s);

    expect(await s.observe(liveNote, 'alice', 'from-old')).toMatchObject({
      body: 'v1-only-client',
    });
    expect(await s.observe(liveNote, 'alice', 'from-new')).toMatchObject({
      body: 'v2-peer',
    });
    expect(await s.observe(liveNote, 'bob', 'from-old')).toMatchObject({
      body: 'v1-only-client',
    });
  });
});
