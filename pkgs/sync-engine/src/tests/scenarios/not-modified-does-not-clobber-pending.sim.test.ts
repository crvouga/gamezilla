import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeDraws,
  acmeSystem,
  addClient,
  connect,
  disconnect,
  expectConverged,
  liveNote,
  liveNotes,
  mutate,
  passTime,
  setNote,
  syncVirtualHost,
} from '../apps/acme';

describe('not modified does not clobber pending', () => {
  test('not_modified refetch does not clobber pending optimistic; later hash miss rebases', async () => {
    await using run = await start(acmeSystem, {
      seed: 640,
      host: syncVirtualHost(),
      draws: acmeDraws({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });

    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'seed' });
    await expectConverged(run);

    // Queue pending without upload (upload loop stopped).
    await run.apply(disconnect, 'alice');
    await run.apply(mutate, 'alice', setNote, {
      id: 'n1',
      body: 'optimistic-pending',
    });
    expect(await run.observe(liveNote('alice', 'n1'))).toMatchObject({
      body: 'optimistic-pending',
    });
    expect(await run.observe(liveNote('server', 'n1'))).toMatchObject({
      body: 'seed',
    });

    // Reconnect: session sync sees unchanged server hash → not_modified;
    // pending mutation rebases on top so optimistic body must survive.
    await run.apply(connect, 'alice');
    await run.apply(passTime, 500);
    expect(await run.observe(liveNote('alice', 'n1'))).toMatchObject({
      body: 'optimistic-pending',
    });

    await run.apply(mutate, 'bob', setNote, { id: 'n1', body: 'from-bob' });
    await expectConverged(run);
    expect(
      (await run.observe(liveNotes('server'))).find((r) => r.id === 'n1')
    ).toBeDefined();
  });
});
