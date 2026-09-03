import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeDraws,
  acmeSystem,
  addClient,
  converge,
  lastMutationId,
  lastMutationOk,
  liveNote,
  mutate,
  net,
  netHeld,
  neverAcme,
  nodeNow,
  outcome,
  passTime,
  setNote,
  skewClock,
  syncVirtualHost,
  untilAcme,
} from '../apps/acme';

/** Two-client acme system with no default clients. */
function openRun(seed: number) {
  return start(acmeSystem, {
    seed,
    host: syncVirtualHost(),
    draws: acmeDraws({ clientCount: 0 }),
    properties: [],
  });
}

describe('sim scenario API', () => {
  test('await using + net hold restore', async () => {
    await using run = await openRun(2);

    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');

    await run.apply(net, 'alice', 'sync', 'hold');
    expect(await run.observe(netHeld('alice', 'sync'))).toBe(true);
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'x' });
    expect(await run.observe(lastMutationOk('alice'))).toBe(true);
    await run.apply(passTime, 200);

    await run.apply(net, 'alice', 'sync', 'ok');
    expect(await run.observe(netHeld('alice', 'sync'))).toBe(false);
    await run.apply(converge);
    expect((await run.observe(liveNote('bob', 'n1')))?.body).toBe('x');
  });

  test('until drives outcome observation', async () => {
    await using run = await openRun(3);

    await run.apply(addClient, 'alice');
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'y' });
    const mutationId = await run.observe(lastMutationId('alice'));
    expect(mutationId).not.toBeNull();
    if (mutationId === null) return;

    await untilAcme(run, outcome('alice', mutationId));
    expect(await run.observe(outcome('alice', mutationId))).toBe('confirmed');
  });

  test('never holds for negative window', async () => {
    await using run = await openRun(7);

    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');

    await run.apply(net, 'bob', 'sync', 'hold');
    await run.apply(net, 'bob', 'live', 'down');
    await run.apply(mutate, 'alice', setNote, {
      id: 'n-never',
      body: 'hidden',
    });
    await neverAcme(run, liveNote('bob', 'n-never'), { forMs: 300 });

    await run.apply(net, 'bob', 'sync', 'ok');
    await run.apply(net, 'bob', 'live', 'ok');
    await run.apply(converge);
    expect((await run.observe(liveNote('bob', 'n-never')))?.body).toBe(
      'hidden'
    );
  });

  test('never fails when target becomes true', async () => {
    await using run = await openRun(8);

    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');
    await run.apply(mutate, 'alice', setNote, {
      id: 'n-seen',
      body: 'visible',
    });
    await expect(
      neverAcme(run, liveNote('bob', 'n-seen'), { forMs: 2_000 })
    ).rejects.toThrow(/neverAcme violated/);
  });

  test('converge neutralizes net effects', async () => {
    await using run = await openRun(4);

    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');
    await run.apply(net, 'bob', 'sync', 'hold');
    expect(await run.observe(netHeld('bob', 'sync'))).toBe(true);
    await run.apply(converge);
    expect(await run.observe(netHeld('bob', 'sync'))).toBe(false);
  });

  test('skewClock shifts and clears node time', async () => {
    await using run = await openRun(5);

    await run.apply(addClient, 'alice');
    const base = await run.observe(nodeNow('alice'));
    await run.apply(skewClock, 'alice', 1_000);
    expect(await run.observe(nodeNow('alice'))).toBe(base + 1_000);
    await run.apply(skewClock, 'alice', 0);
    expect(await run.observe(nodeNow('alice'))).toBe(base);
  });

  test("net faults layer over a hold; only 'ok' clears it", async () => {
    await using run = await openRun(6);

    await run.apply(addClient, 'alice');
    await run.apply(net, 'alice', 'sync', 'hold');
    expect(await run.observe(netHeld('alice', 'sync'))).toBe(true);
    await run.apply(net, 'alice', 'sync', { dropProbability: 1 });
    expect(await run.observe(netHeld('alice', 'sync'))).toBe(true);
    await run.apply(net, 'alice', 'sync', 'ok');
    expect(await run.observe(netHeld('alice', 'sync'))).toBe(false);
  });
});
