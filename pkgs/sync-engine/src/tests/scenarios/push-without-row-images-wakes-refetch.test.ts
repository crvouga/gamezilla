import { describe, test } from 'bun:test';
import { openWorld } from '../../sim/world';
import { acmeDomainPack, expectLiveNote, setNoteNoFanout } from '../apps/acme';

describe('push without row images wakes refetch', () => {
  test('mutation without capture images converges via wake+refetch with rowImageFanout', async () => {
    // rowImageFanout true: proves pushSeq-only pushes still wake peers when images absent.
    await using world = await openWorld({
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
