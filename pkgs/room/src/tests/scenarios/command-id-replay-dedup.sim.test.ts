import { describe, expect, test } from 'bun:test';
import {
  addClient,
  clock,
  injectToServer,
  logSeq,
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

describe('room sim: command-id replay dedup (E-B02)', () => {
  test('same commandId applies once across reconnect storm', async () => {
    await using s = await counterSystem.script({
      seed: 42,
    });
    for (const id of ['alice', 'bob']) {
      await s.apply(addClient, { id });
    }
    await expectConverged(s);

    const frame = commandWire({
      id: 'fixed-cmd-1',
      ts: await s.observe(clock),
      payload: Increment({}),
    });
    await s.apply(injectToServer, {
      clientId: 'alice',
      raw: frame,
      direct: true,
    });
    expect(counterValue(await readClient(s, 'alice'))).toBe(1);

    for (let i = 0; i < 5; i += 1) {
      await s.apply(injectToServer, {
        clientId: 'alice',
        raw: frame,
        direct: true,
      });
    }
    await s.apply(takeOver, 'alice');
    await s.apply(injectToServer, {
      clientId: 'alice',
      raw: frame,
      direct: true,
    });

    await expectConverged(s);
    expect(counterValue(await readServer(s))).toBe(1);
    expect(counterValue(await readClient(s, 'alice'))).toBe(1);
    expect(counterValue(await readClient(s, 'bob'))).toBe(1);
    await expectHashMatch(s, 'alice');
    expect(await s.observe(logSeq)).toBe(1);
  });
});
