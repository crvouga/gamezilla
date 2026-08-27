import { describe, expect, test } from 'bun:test';
import {
  expectLiveNote,
  isLiveNote,
  acmeDomainPack,
  setNote,
} from '../apps/acme';
import { openSimWorld } from '../../sim/world';

describe('entry channel wakes never-held row', () => {
  test('world entryChannel delivers peer create before local ever held the row', async () => {
    await using world = await openSimWorld({
      domain: acmeDomainPack,
      seed: 1220,
    });
    // notesWorld entryChannel = NOTES_WORLD_TOPIC (no prior row for n-fresh).
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    expect(await isLiveNote(b.db, 'n-fresh')).toBe(false);

    await a.mutate(setNote, { id: 'n-fresh', body: 'via-entry' });
    await world.assertConverged();

    await expectLiveNote(b.db, 'n-fresh', { body: 'via-entry' });
  });
});
