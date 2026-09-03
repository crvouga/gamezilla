import { describe, expect, test } from 'bun:test';
import {
  clock,
  dispatch,
  injectToServer,
  rosterSize,
  takeOver,
} from '../../sim/scenario';
import { expectConverged } from '../expect-converged';
import { counterValue, Increment } from '../fixtures/counter-module';
import { bootCounter } from '../scenario/boot-counter';
import {
  expectHashMatch,
  readClient,
  readServer,
} from '../scenario/read-state';
import { commandWire } from './wire-helpers';

describe('room sim: session take-over (E-C04)', () => {
  test('take-over mid-command does not double-apply', async () => {
    await using run = await bootCounter(['alice', 'bob']);

    const frame = commandWire({
      id: 'takeover-cmd',
      ts: await run.observe(clock),
      payload: Increment({}),
    });
    await run.apply(injectToServer, {
      clientId: 'alice',
      raw: frame,
      direct: true,
    });

    await run.apply(takeOver, 'alice');
    await run.apply(injectToServer, {
      clientId: 'alice',
      raw: frame,
      direct: true,
    });
    await run.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    await expectConverged(run);

    expect(counterValue(await readServer(run))).toBe(2);
    expect(counterValue(await readClient(run, 'alice'))).toBe(2);
    expect(counterValue(await readClient(run, 'bob'))).toBe(2);
    await expectHashMatch(run, 'alice');
    expect(await run.observe(rosterSize)).toBe(2);
  });
});
