import { describe, test } from 'bun:test';
import { expectLiveNote, setNote } from '../apps/acme';
import { openAcmeWorld } from '../apps/acme/system';

describe('full partition during write then heal', () => {
  test('partition then heal converges domain state', async () => {
    await using world = await openAcmeWorld({
      seed: 33,
      knobs: {
        clientCount: 0,
      },
    });

    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await a.mutate(setNote, { id: 'warm', body: 'w' });
    await world.assertConverged();

    {
      using _pa = world.net('alice').set('down');
      using _pb = world.net('bob').set('down');
      await a.mutate(setNote, { id: 'n1', body: 'during-partition' });
      await world.advance(100);
    }
    await world.assertConverged();

    await expectLiveNote(b.db, 'n1', { body: 'during-partition' });
  });
});
