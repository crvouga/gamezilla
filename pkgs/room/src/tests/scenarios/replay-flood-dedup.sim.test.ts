import { describe, expect, test } from 'bun:test';
import { addClient, clock, injectToServer, logSeq } from '../../sim/scenario';
import { counterSystem } from '../apps/counter/system';
import { expectConverged } from '../expect-converged';
import { counterValue, Increment } from '../fixtures/counter-module';
import {
  expectHashMatch,
  readClient,
  readServer,
} from '../scenario/read-state';
import { commandWire } from './wire-helpers';

describe('room sim: replay flood dedup (E-D01)', () => {
  test('N replays of one commandId mutate once', async () => {
    await using s = await counterSystem.script({ seed: 42 });
    await s.apply(addClient, { id: 'alice' });
    await expectConverged(s);

    const frame = commandWire({
      id: 'flood-1',
      ts: await s.observe(clock),
      payload: Increment({}),
    });
    for (let i = 0; i < 50; i += 1) {
      await s.apply(injectToServer, {
        clientId: 'alice',
        raw: frame,
        direct: true,
      });
    }
    await expectConverged(s);
    expect(counterValue(await readServer(run))).toBe(1);
    expect(counterValue(await readClient(s, 'alice'))).toBe(1);
    await expectHashMatch(s, 'alice');
    expect(await s.observe(logSeq)).toBe(1);
  });
});
