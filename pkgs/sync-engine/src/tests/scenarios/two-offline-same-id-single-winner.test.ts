import { describe, expect, test } from 'bun:test';
import {
  acmeDomainPack,
  readLiveNotes,
  setNote,
} from '../apps/acme';
import { openSimWorld } from '../../sim/world';

describe('two offline same id single winner', () => {
  test('two clients offline conflict then converge to one winner', async () => {
    await using world = await openSimWorld({
      domain: acmeDomainPack,
      seed: 7,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await world.runFor(100);

    a.online(false);
    b.online(false);
    await a.mutate(setNote, { id: 'shared', body: 'from-a' });
    await b.mutate(setNote, { id: 'shared', body: 'from-b' });

    a.online(true);
    b.online(true);
    await world.assertConverged();

    const server = await readLiveNotes(world.server.db);
    const winner = server.find((r) => r.id === 'shared');
    expect(winner).toBeDefined();
    expect(winner?.body === 'from-a' || winner?.body === 'from-b').toBe(true);

    const localA = await readLiveNotes(a.db);
    const localB = await readLiveNotes(b.db);
    expect(localA.find((r) => r.id === 'shared')?.body).toBe(winner?.body);
    expect(localB.find((r) => r.id === 'shared')?.body).toBe(winner?.body);
  });
});
