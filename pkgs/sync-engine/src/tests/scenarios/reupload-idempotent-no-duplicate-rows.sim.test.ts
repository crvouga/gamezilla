import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeDraws,
  acmeSystem,
  addClient,
  expectConverged,
  liveNote,
  liveNotes,
  mutate,
  online,
  passTime,
  setNote,
  syncVirtualHost,
} from '../apps/acme';

describe('reupload idempotent no duplicate rows', () => {
  test('reconnect after offline set does not duplicate domain rows', async () => {
    await using run = await start(acmeSystem, {
      seed: 70,
      host: syncVirtualHost(),
      draws: acmeDraws({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });

    await run.apply(online, 'alice', false);
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'once' });
    await run.apply(online, 'alice', true);
    await expectConverged(run);

    // Force another upload cycle via brief offline/online.
    await run.apply(online, 'alice', false);
    await run.apply(passTime, 20);
    await run.apply(online, 'alice', true);
    await expectConverged(run);

    expect(await run.observe(liveNote('bob', 'n1'))).toMatchObject({
      body: 'once',
    });
    const server = await run.observe(liveNotes('server'));
    expect(server.filter((r) => r.id === 'n1')).toHaveLength(1);
  });

  test('repeated setNote on same id keeps single live row', async () => {
    await using run = await start(acmeSystem, {
      seed: 71,
      host: syncVirtualHost(),
      draws: acmeDraws({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'v1' });
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'v2' });
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'v3' });
    await expectConverged(run);
    const server = await run.observe(liveNotes('server'));
    expect(server.filter((r) => r.id === 'n1')).toHaveLength(1);
    expect(await run.observe(liveNote('alice', 'n1'))).toMatchObject({
      body: 'v3',
    });
  });
});
