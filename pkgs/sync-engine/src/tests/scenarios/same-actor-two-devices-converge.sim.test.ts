import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  expectConverged,
  liveNote,
  mutate,
  setNote,
  syncVirtualHost,
} from '../apps/acme';

describe('same actor two devices converge', () => {
  test('two devices same actor converge concurrent writes', async () => {
    await using run = await start(acmeSystem, {
      seed: 509,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, {
      id: 'phone',
      actorId: 'user-1',
    });
    await run.apply(addClient, {
      id: 'tablet',
      actorId: 'user-1',
    });

    await run.apply(mutate, 'phone', setNote, { id: 'from-phone', body: 'p' });
    await run.apply(mutate, 'tablet', setNote, {
      id: 'from-tablet',
      body: 't',
    });
    await expectConverged(run);

    expect(await run.observe(liveNote('phone', 'from-phone'))).toMatchObject({
      body: 'p',
    });
    expect(await run.observe(liveNote('phone', 'from-tablet'))).toMatchObject({
      body: 't',
    });
    expect(await run.observe(liveNote('tablet', 'from-phone'))).toMatchObject({
      body: 'p',
    });
    expect(await run.observe(liveNote('tablet', 'from-tablet'))).toMatchObject({
      body: 't',
    });
  });
});
