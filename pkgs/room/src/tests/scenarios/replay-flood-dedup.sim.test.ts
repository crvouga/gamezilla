import { describe, expect, test } from 'bun:test';
import { addClient, clock, injectToServer, logSeq } from '../../sim/scenario';
import { counterSystem } from '../apps/counter/system';
import { expectConverged } from '../expect-converged';
import { counterValue, Increment } from '../fixtures/counter-module';
import { openRoom } from '../scenario/open-room';
import {
  expectHashMatch,
  readClient,
  readServer,
} from '../scenario/read-state';
import { commandWire } from './wire-helpers';

describe('room sim: replay flood dedup (E-D01)', () => {
  test('N replays of one commandId mutate once', async () => {
    await using run = await openRoom(counterSystem);
    await run.apply(addClient, { id: 'alice' });
    await expectConverged(run);

    const frame = commandWire({
      id: 'flood-1',
      ts: await run.observe(clock),
      payload: Increment({}),
    });
    for (let i = 0; i < 50; i += 1) {
      await run.apply(injectToServer, {
        clientId: 'alice',
        raw: frame,
        direct: true,
      });
    }
    await expectConverged(run);
    expect(counterValue(await readServer(run))).toBe(1);
    expect(counterValue(await readClient(run, 'alice'))).toBe(1);
    await expectHashMatch(run, 'alice');
    expect(await run.observe(logSeq)).toBe(1);
  });
});
