import { describe, test } from 'bun:test';
import {
  expectLiveNote,
  acmeDomainPack,
  setNote,
} from '../apps/acme';
import { openSimWorld } from '../../sim/world';

describe('full partition during write then heal', () => {
  test('partition then heal converges domain state', async () => {
    await using world = await openSimWorld({
      domain: acmeDomainPack,
      seed: 33,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await a.mutate(setNote, { id: 'warm', body: 'w' });
    await world.assertConverged();

    {
      using _pa = world.net('alice').set('down');
      using _pb = world.net('bob').set('down');
      await a.mutate(setNote, { id: 'n1', body: 'during-partition' });
      await world.runFor(100);
    }
    await world.assertConverged();

    await expectLiveNote(b.db, 'n1', { body: 'during-partition' });
  });
});
