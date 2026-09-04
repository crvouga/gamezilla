import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  expectConverged,
  lastMutationId,
  lastMutationOk,
  liveNote,
  mutate,
  net,
  netHeld,
  neverAcme,
  nodeNow,
  outcome,
  setNote,
  skewClock,
  untilAcme,
} from '../apps/acme';

/** Two-client acme system with no default clients. */
function openScript(seed: number) {
  return acmeSystem.script({
    seed,
    args: { clientCount: 0 },
  });
}

describe('sim scenario API', () => {
  test('await using + net hold restore', async () => {
    await using s = await openScript(2);

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');

    await s.apply(net, 'alice', 'sync', 'hold');
    expect(await s.observe(netHeld, 'alice', 'sync')).toBe(true);
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'x' });
    expect(await s.observe(lastMutationOk, 'alice')).toBe(true);
    await s.elapse(200);

    await s.apply(net, 'alice', 'sync', 'ok');
    expect(await s.observe(netHeld, 'alice', 'sync')).toBe(false);
    await expectConverged(s);
    expect((await s.observe(liveNote, 'bob', 'n1'))?.body).toBe('x');
  });

  test('until drives outcome observation', async () => {
    await using s = await openScript(3);

    await s.apply(addClient, 'alice');
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'y' });
    const mutationId = await s.observe(lastMutationId, 'alice');
    expect(mutationId).not.toBeNull();
    if (mutationId === null) return;

    await untilAcme(s, (s) => outcome(s, 'alice', mutationId));
    expect(await s.observe(outcome, 'alice', mutationId)).toBe('confirmed');
  });

  test('never holds for negative window', async () => {
    await using s = await openScript(7);

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');

    await s.apply(net, 'bob', 'sync', 'hold');
    await s.apply(net, 'bob', 'live', 'down');
    await s.apply(mutate, 'alice', setNote, {
      id: 'n-never',
      body: 'hidden',
    });
    await neverAcme(s, (s) => liveNote(s, 'bob', 'n-never'), { forMs: 300 });

    await s.apply(net, 'bob', 'sync', 'ok');
    await s.apply(net, 'bob', 'live', 'ok');
    await expectConverged(s);
    expect((await s.observe(liveNote, 'bob', 'n-never'))?.body).toBe('hidden');
  });

  test('never fails when target becomes true', async () => {
    await using s = await openScript(8);

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');
    await s.apply(mutate, 'alice', setNote, {
      id: 'n-seen',
      body: 'visible',
    });
    await expect(
      neverAcme(s, (s) => liveNote(s, 'bob', 'n-seen'), { forMs: 2_000 })
    ).rejects.toThrow(/never/);
  });

  test('converge neutralizes net effects', async () => {
    await using s = await openScript(4);

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');
    await s.apply(net, 'bob', 'sync', 'hold');
    expect(await s.observe(netHeld, 'bob', 'sync')).toBe(true);
    await expectConverged(s);
    expect(await s.observe(netHeld, 'bob', 'sync')).toBe(false);
  });

  test('skewClock shifts and clears node time', async () => {
    await using s = await openScript(5);

    await s.apply(addClient, 'alice');
    const base = await s.observe(nodeNow, 'alice');
    await s.apply(skewClock, 'alice', 1_000);
    expect(await s.observe(nodeNow, 'alice')).toBe(base + 1_000);
    await s.apply(skewClock, 'alice', 0);
    expect(await s.observe(nodeNow, 'alice')).toBe(base);
  });

  test("net faults layer over a hold; only 'ok' clears it", async () => {
    await using s = await openScript(6);

    await s.apply(addClient, 'alice');
    await s.apply(net, 'alice', 'sync', 'hold');
    expect(await s.observe(netHeld, 'alice', 'sync')).toBe(true);
    await s.apply(net, 'alice', 'sync', { dropProbability: 1 });
    expect(await s.observe(netHeld, 'alice', 'sync')).toBe(true);
    await s.apply(net, 'alice', 'sync', 'ok');
    expect(await s.observe(netHeld, 'alice', 'sync')).toBe(false);
  });
});
