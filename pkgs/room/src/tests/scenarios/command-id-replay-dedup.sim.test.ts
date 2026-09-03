import { describe, expect, test } from 'bun:test';
import { clock, injectToServer, logSeq, takeOver } from '../../sim/scenario';
import { expectConverged } from '../expect-converged';
import { counterValue, Increment } from '../fixtures/counter-module';
import { bootCounter } from '../scenario/boot-counter';
import {
  expectHashMatch,
  readClient,
  readServer,
} from '../scenario/read-state';
import { commandWire } from './wire-helpers';

describe('room sim: command-id replay dedup (E-B02)', () => {
  test('same commandId applies once across reconnect storm', async () => {
    await using run = await bootCounter(['alice', 'bob']);

    const frame = commandWire({
      id: 'fixed-cmd-1',
      ts: await run.observe(clock),
      payload: Increment({}),
    });
    await run.apply(injectToServer, {
      clientId: 'alice',
      raw: frame,
      direct: true,
    });
    expect(counterValue(await readClient(run, 'alice'))).toBe(1);

    for (let i = 0; i < 5; i += 1) {
      await run.apply(injectToServer, {
        clientId: 'alice',
        raw: frame,
        direct: true,
      });
    }
    await run.apply(takeOver, 'alice');
    await run.apply(injectToServer, {
      clientId: 'alice',
      raw: frame,
      direct: true,
    });

    await expectConverged(run);
    expect(counterValue(await readServer(run))).toBe(1);
    expect(counterValue(await readClient(run, 'alice'))).toBe(1);
    expect(counterValue(await readClient(run, 'bob'))).toBe(1);
    await expectHashMatch(run, 'alice');
    expect(await run.observe(logSeq)).toBe(1);
  });
});
