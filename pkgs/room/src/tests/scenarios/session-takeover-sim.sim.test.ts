import { describe, expect, test } from 'bun:test';
import {
  addClient,
  clock,
  dispatch,
  injectToServer,
  rosterSize,
  takeOver,
} from '../../sim/scenario';
import { counterSystem } from '../apps/counter/system';
import { expectConverged } from '../expect-converged';
import { counterValue, Increment } from '../fixtures/counter-module';
import {
  expectHashMatch,
  readClient,
  readServer,
} from '../scenario/read-state';
import { commandWire } from './wire-helpers';

describe('room sim: session take-over (E-C04)', () => {
  test('take-over mid-command does not double-apply', async () => {
    await using s = await counterSystem.script({
      seed: 42,
    });
    for (const id of ['alice', 'bob']) {
      await s.apply(addClient, { id });
    }
    await expectConverged(s);

    const frame = commandWire({
      id: 'takeover-cmd',
      ts: await s.observe(clock),
      payload: Increment({}),
    });
    await s.apply(injectToServer, {
      clientId: 'alice',
      raw: frame,
      direct: true,
    });

    await s.apply(takeOver, 'alice');
    await s.apply(injectToServer, {
      clientId: 'alice',
      raw: frame,
      direct: true,
    });
    await s.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    await expectConverged(s);

    expect(counterValue(await readServer(run))).toBe(2);
    expect(counterValue(await readClient(s, 'alice'))).toBe(2);
    expect(counterValue(await readClient(s, 'bob'))).toBe(2);
    await expectHashMatch(s, 'alice');
    expect(await s.observe(rosterSize)).toBe(2);
  });
});
