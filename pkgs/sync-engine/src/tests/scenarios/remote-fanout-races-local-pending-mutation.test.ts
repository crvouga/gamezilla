import { describe, test } from 'bun:test';
import { acmeDomainPack, setNote } from '../apps/acme';
import { openSimWorld } from '../../sim/world';

describe('remote fanout races local pending mutation', () => {
  test('fanout races local pending mutation on same row then converges', async () => {
    await using world = await openSimWorld({
      domain: acmeDomainPack,
      seed: 29,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.mutate(setNote, { id: 'n1', body: 'from-a' });
    await world.assertConverged();

    b.online(false);
    await b.mutate(setNote, { id: 'n1', body: 'from-b-pending' });
    b.online(true);
    await a.mutate(setNote, { id: 'n1', body: 'from-a-2' });
    await world.runFor(500);
    await world.assertConverged();
  });
});
