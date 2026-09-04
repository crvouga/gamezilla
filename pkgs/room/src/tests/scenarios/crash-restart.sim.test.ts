import { describe, expect, test } from 'bun:test';
import {
  addClient,
  armCrashAt,
  crash,
  disconnect,
  dispatch,
  restart,
  serverCrash,
  serverCrashed,
  serverRestart,
} from '../../sim/scenario';
import { counterSystem } from '../apps/counter/system';
import { expectConverged } from '../expect-converged';
import { counterValue, Increment } from '../fixtures/counter-module';
import {
  expectHashMatch,
  readClient,
  readServer,
} from '../scenario/read-state';

describe('room sim: client/server crash restart', () => {
  test('client crash keeps local queue; restart + settle converges', async () => {
    await using s = await counterSystem.script({
      seed: 'crash-client-1',
    });
    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });
    await expectConverged(s);

    await s.apply(disconnect, 'alice');
    await s.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    await s.apply(crash, 'alice');

    await s.apply(dispatch, {
      clientId: 'bob',
      payload: Increment({}),
    });
    await s.elapse(0);

    await s.apply(restart, 'alice');
    await expectConverged(s);
    expect(counterValue(await readServer(s))).toBe(2);
    expect(counterValue(await readClient(s, 'alice'))).toBe(2);
    await expectHashMatch(s, 'alice');
  });

  test('server crash + restart hydrates log and converges', async () => {
    await using s = await counterSystem.script({
      seed: 'crash-server-1',
    });
    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });
    await s.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    await s.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    await s.elapse(0);
    expect(counterValue(await readServer(s))).toBe(2);

    await s.apply(serverCrash);
    expect(await s.observe(serverCrashed)).toBe(true);
    await s.apply(serverRestart);
    expect(await s.observe(serverCrashed)).toBe(false);
    expect(counterValue(await readServer(s))).toBe(2);

    await expectConverged(s);
    await expectHashMatch(s, 'alice');
  });

  test('boundary afterNextCommitted crashes client; settle restores', async () => {
    await using s = await counterSystem.script({
      seed: 'boundary-committed-1',
    });
    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });
    await s.apply(armCrashAt, {
      clientId: 'alice',
      event: 'afterNextCommitted' as const,
    });
    await s.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    await s.elapse(0);
    await expectConverged(s);
    expect(counterValue(await readServer(s))).toBe(1);
  });

  test('checkInvariants passes on healthy run', async () => {
    await using s = await counterSystem.script({
      seed: 'inv-1',
    });
    await s.apply(addClient, { id: 'alice' });
    await s.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    await s.elapse(0);
    await expectConverged(s);
  });
});
