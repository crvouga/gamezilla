import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  expectConverged,
  mutate,
  online,
  setNote,
} from '../apps/acme';
import { liveNotes } from '../apps/acme/reads';

describe('two offline same id single winner', () => {
  test('two clients offline conflict then converge to one winner', async () => {
    await using s = await acmeSystem.script({
      seed: 7,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');
    await s.elapse(100);

    await s.apply(online, 'alice', false);
    await s.apply(online, 'bob', false);
    await s.apply(mutate, 'alice', setNote, { id: 'shared', body: 'from-a' });
    await s.apply(mutate, 'bob', setNote, { id: 'shared', body: 'from-b' });

    await s.apply(online, 'alice', true);
    await s.apply(online, 'bob', true);
    await expectConverged(s);

    const server = await s.observe(liveNotes, 'server');
    const winner = server.find((r) => r.id === 'shared');
    expect(winner).toBeDefined();
    expect(winner?.body === 'from-a' || winner?.body === 'from-b').toBe(true);

    const localA = await s.observe(liveNotes, 'alice');
    const localB = await s.observe(liveNotes, 'bob');
    expect(localA.find((r) => r.id === 'shared')?.body).toBe(winner?.body);
    expect(localB.find((r) => r.id === 'shared')?.body).toBe(winner?.body);
  });
});
