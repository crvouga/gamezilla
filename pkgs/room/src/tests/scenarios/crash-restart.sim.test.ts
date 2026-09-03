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
import { openRoom } from '../scenario/open-room';
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
    await using run = await openRoom(counterSystem, {
      seed: 'crash-client-1',
    });
    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });
    await expectConverged(run);

    await run.apply(disconnect, 'alice');
    await run.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    await run.apply(crash, 'alice');

    await run.apply(dispatch, {
      clientId: 'bob',
      payload: Increment({}),
    });
    await run.elapse(0);

    await run.apply(restart, 'alice');
    await expectConverged(run);
    expect(counterValue(await readServer(run))).toBe(2);
    expect(counterValue(await readClient(run, 'alice'))).toBe(2);
    await expectHashMatch(run, 'alice');
  });

  test('server crash + restart hydrates log and converges', async () => {
    await using run = await openRoom(counterSystem, {
      seed: 'crash-server-1',
    });
    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });
    await run.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    await run.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    await run.elapse(0);
    expect(counterValue(await readServer(run))).toBe(2);

    await run.apply(serverCrash);
    expect(await run.observe(serverCrashed)).toBe(true);
    await run.apply(serverRestart);
    expect(await run.observe(serverCrashed)).toBe(false);
    expect(counterValue(await readServer(run))).toBe(2);

    await expectConverged(run);
    await expectHashMatch(run, 'alice');
  });

  test('boundary afterNextCommitted crashes client; settle restores', async () => {
    await using run = await openRoom(counterSystem, {
      seed: 'boundary-committed-1',
    });
    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });
    await run.apply(armCrashAt, {
      clientId: 'alice',
      event: 'afterNextCommitted' as const,
    });
    await run.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    await run.elapse(0);
    await expectConverged(run);
    expect(counterValue(await readServer(run))).toBe(1);
  });

  test('checkInvariants passes on healthy run', async () => {
    await using run = await openRoom(counterSystem, { seed: 'inv-1' });
    await run.apply(addClient, { id: 'alice' });
    await run.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    await run.elapse(0);
    await expectConverged(run);
  });
});
