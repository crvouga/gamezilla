import { describe, test } from 'bun:test';
import {
  expectLiveNote,
  acmeDomainPack,
  setNoteNoFanout,
} from '../apps/acme';
import { openSimWorld } from '../../sim/world';

describe('push without row images wakes refetch', () => {
  test('mutation without capture images converges via wake+refetch with rowImageFanout', async () => {
    // rowImageFanout true: proves pushSeq-only pushes still wake peers when images absent.
    await using world = await openSimWorld({
      domain: acmeDomainPack,
      seed: 680,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.mutate(setNoteNoFanout, { id: 'n1', body: 'no-images' });
    await world.assertConverged();

    await expectLiveNote(b.db, 'n1', { body: 'no-images' });
  });
});
