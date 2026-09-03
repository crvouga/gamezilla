import { describe, expect, test } from 'bun:test';
import { connect, converge, disconnect, dispatch } from '../../sim/scenario';
import { counterValue, Increment } from '../fixtures/counter-module';
import { bootCounter } from '../scenario/boot-counter';
import {
  expectHashMatch,
  readClient,
  readServer,
} from '../scenario/read-state';

describe('room sim: offline queues interleave (E-B03)', () => {
  test('both offline queues flush; server order wins', async () => {
    await using run = await bootCounter(['alice', 'bob', 'carol']);

    await run.apply(disconnect, 'alice');
    await run.apply(disconnect, 'bob');
    await run.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    await run.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    await run.apply(dispatch, {
      clientId: 'bob',
      payload: Increment({}),
    });
    await run.apply(dispatch, {
      clientId: 'carol',
      payload: Increment({}),
    });
    expect(counterValue(await readClient(run, 'carol'))).toBe(1);

    await run.apply(connect, 'alice');
    await run.apply(connect, 'bob');
    await run.apply(converge);
    expect(counterValue(await readServer(run))).toBe(4);
    expect(counterValue(await readClient(run, 'alice'))).toBe(4);
    await expectHashMatch(run, 'alice');
    await expectHashMatch(run, 'bob');
    await expectHashMatch(run, 'carol');
  });
});
