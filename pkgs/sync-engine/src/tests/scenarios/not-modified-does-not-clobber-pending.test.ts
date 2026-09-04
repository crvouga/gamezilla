import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  connect,
  disconnect,
  expectConverged,
  liveNote,
  liveNotes,
  mutate,
  setNote,
} from '../apps/acme';

describe('not modified does not clobber pending', () => {
  test('not_modified refetch does not clobber pending optimistic; later hash miss rebases', async () => {
    await using s = await acmeSystem.script({
      seed: 640,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });

    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'seed' });
    await expectConverged(s);

    // Queue pending without upload (upload loop stopped).
    await s.apply(disconnect, 'alice');
    await s.apply(mutate, 'alice', setNote, {
      id: 'n1',
      body: 'optimistic-pending',
    });
    expect(await s.observe(liveNote, 'alice', 'n1')).toMatchObject({
      body: 'optimistic-pending',
    });
    expect(await s.observe(liveNote, 'server', 'n1')).toMatchObject({
      body: 'seed',
    });

    // Reconnect: session sync sees unchanged server hash → not_modified;
    // pending mutation rebases on top so optimistic body must survive.
    await s.apply(connect, 'alice');
    await s.elapse(500);
    expect(await s.observe(liveNote, 'alice', 'n1')).toMatchObject({
      body: 'optimistic-pending',
    });

    await s.apply(mutate, 'bob', setNote, { id: 'n1', body: 'from-bob' });
    await expectConverged(s);
    expect(
      (await s.observe(liveNotes, 'server')).find((r) => r.id === 'n1')
    ).toBeDefined();
  });
});
