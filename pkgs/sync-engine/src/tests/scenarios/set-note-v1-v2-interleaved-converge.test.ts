import { describe, expect, test } from 'bun:test';
import {
  expectLiveNote,
  expectNotesMatchServer,
  notesDomainPack,
  notesMutationRegistry,
  readLiveNotes,
  setNote,
  setNoteV2,
} from '../../domain-packs/notes-app';
import { RELIABLE_FAULTS } from '../../sim/faults';
import { openSimWorld } from '../../sim/world';

/** Old-client registry: setNoteV2 not registered locally (server still has both). */
function mutationRegistryV1Only(): typeof notesMutationRegistry {
  return Object.fromEntries(
    Object.entries(notesMutationRegistry).filter(
      ([name]) => name !== 'setNoteV2'
    )
  ) as typeof notesMutationRegistry;
}

describe('set note v1 v2 interleaved converge', () => {
  test('setNote and setNoteV2 interleaved writes converge', async () => {
    await using world = await openSimWorld({
      domain: notesDomainPack,
      seed: 660,
      faults: RELIABLE_FAULTS,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.mutate(setNote, { id: 'shared', body: 'v1-a' });
    await b.mutate(setNoteV2, { id: 'shared', body: 'v2-b' });
    await a.mutate(setNote, { id: 'only-a', body: 'from-v1' });
    await b.mutate(setNoteV2, { id: 'only-b', body: 'from-v2' });
    await world.assertConverged();

    await expectLiveNote(a.db, 'only-a', { body: 'from-v1' });
    await expectLiveNote(b.db, 'only-b', { body: 'from-v2' });
    await expectNotesMatchServer(a.db, world.server.db);
    await expectNotesMatchServer(b.db, world.server.db);
    const shared = (await readLiveNotes(world.server.db)).find(
      (r) => r.id === 'shared'
    );
    expect(shared?.body === 'v1-a' || shared?.body === 'v2-b').toBe(true);
  });

  test('mutation-v2-rollout-old-client-still-replays-v1', async () => {
    await using world = await openSimWorld({
      domain: notesDomainPack,
      seed: 661,
      faults: RELIABLE_FAULTS,
    });
    const a = await world.addClient({
      id: 'alice',
      mutationRegistry: mutationRegistryV1Only(),
    });
    const b = await world.addClient({ id: 'bob' });

    await a.mutate(setNote, { id: 'from-old', body: 'v1-only-client' });
    await b.mutate(setNoteV2, { id: 'from-new', body: 'v2-peer' });
    await world.assertConverged();

    await expectLiveNote(a.db, 'from-old', { body: 'v1-only-client' });
    await expectLiveNote(a.db, 'from-new', { body: 'v2-peer' });
    await expectLiveNote(b.db, 'from-old', { body: 'v1-only-client' });
    await expectNotesMatchServer(a.db, world.server.db);
    await expectNotesMatchServer(b.db, world.server.db);
  });
});
