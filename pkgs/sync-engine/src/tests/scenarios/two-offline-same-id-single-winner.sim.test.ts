import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeDraws,
  acmeSystem,
  addClient,
  assertConverged,
  mutate,
  online,
  passTime,
  setNote,
  syncVirtualHost,
} from '../apps/acme';
import { liveNotes } from '../apps/acme/reads';

describe('two offline same id single winner', () => {
  test('two clients offline conflict then converge to one winner', async () => {
    await using run = await start(acmeSystem, {
      seed: 7,
      host: syncVirtualHost(),
      draws: acmeDraws({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');
    await run.apply(passTime, 100);

    await run.apply(online, 'alice', false);
    await run.apply(online, 'bob', false);
    await run.apply(mutate, 'alice', setNote, { id: 'shared', body: 'from-a' });
    await run.apply(mutate, 'bob', setNote, { id: 'shared', body: 'from-b' });

    await run.apply(online, 'alice', true);
    await run.apply(online, 'bob', true);
    await run.apply(assertConverged);

    const server = await run.observe(liveNotes('server'));
    const winner = server.find((r) => r.id === 'shared');
    expect(winner).toBeDefined();
    expect(winner?.body === 'from-a' || winner?.body === 'from-b').toBe(true);

    const localA = await run.observe(liveNotes('alice'));
    const localB = await run.observe(liveNotes('bob'));
    expect(localA.find((r) => r.id === 'shared')?.body).toBe(winner?.body);
    expect(localB.find((r) => r.id === 'shared')?.body).toBe(winner?.body);
  });
});
