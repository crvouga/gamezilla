import { describe, expect, test } from 'bun:test';
import {
  addClient,
  clock,
  dispatch,
  hold,
  release,
  roomEpoch,
} from '../../sim/scenario';
import { deadlineSystem } from '../apps/deadline/system';
import { expectConverged } from '../expect-converged';
import {
  ActBeforeDeadline,
  deadlineAt,
  deadlineOutcome,
  StartDeadline,
} from '../fixtures/deadline-module';
import {
  expectHashMatch,
  readClient,
  readServer,
} from '../scenario/read-state';

describe('kit: deadline vs action (M-F07)', () => {
  test('partitioned lagging client cannot win after deadline', async () => {
    await using s = await deadlineSystem.script({
      seed: 42,
      host: roomEpoch(deadlineSystem, 5_000),
    });
    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });
    await expectConverged(s);

    await s.apply(dispatch, {
      clientId: 'alice',
      payload: StartDeadline({ durationMs: 50 }),
    });
    const dl = deadlineAt(await readServer(s));

    await s.apply(hold, 'bob');
    await s.elapse(80);
    expect(await s.observe(clock)).toBeGreaterThanOrEqual(dl);
    await s.apply(dispatch, {
      clientId: 'bob',
      payload: ActBeforeDeadline({}),
    });
    await s.apply(release, 'bob');

    await expectConverged(s);
    expect(deadlineOutcome(await readServer(s))).toBe('expired');
    expect(deadlineOutcome(await readClient(s, 'alice'))).toBe('expired');
    expect(deadlineOutcome(await readClient(s, 'bob'))).toBe('expired');
    await expectHashMatch(s, 'alice');
  });
});
