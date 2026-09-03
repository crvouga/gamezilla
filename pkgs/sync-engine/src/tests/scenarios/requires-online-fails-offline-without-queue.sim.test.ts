import { describe, expect, test } from 'bun:test';
import { script } from '@pkgs/dst';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  expectConverged,
  lastMutationFailures,
  lastMutationId,
  lastMutationOk,
  liveNote,
  mutate,
  online,
  outcome,
  requiresOnlineNote,
  syncVirtualHost,
  untilAcme,
} from '../apps/acme';

describe('requires online fails offline without queue', () => {
  test('offline mutate fails with OFFLINE and does not queue', async () => {
    await using run = await script(acmeSystem, {
      seed: 510,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(online, 'alice', false);

    await run.apply(mutate, 'alice', requiresOnlineNote, {
      id: 'n1',
      body: 'need-net',
    });
    expect(await run.observe(lastMutationOk('alice'))).toBe(false);
    expect(await run.observe(lastMutationFailures('alice'))).toContain(
      'OFFLINE'
    );

    await run.apply(online, 'alice', true);
    await run.apply(mutate, 'alice', requiresOnlineNote, {
      id: 'n1',
      body: 'online-ok',
    });
    expect(await run.observe(lastMutationOk('alice'))).toBe(true);
    const okId = await run.observe(lastMutationId('alice'));
    expect(okId).not.toBeNull();
    if (okId === null) return;

    await untilAcme(run, outcome('alice', okId));
    expect(await run.observe(outcome('alice', okId))).toBe('confirmed');
    await expectConverged(run);
    expect(await run.observe(liveNote('alice', 'n1'))).toMatchObject({
      body: 'online-ok',
    });
  });
});
