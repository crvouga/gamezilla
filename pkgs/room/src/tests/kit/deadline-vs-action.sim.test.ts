import { describe, expect, test } from 'bun:test';
import {
  addClient,
  clock,
  converge,
  dispatch,
  hold,
  passTime,
  release,
  startRoom,
} from '../../sim/scenario';
import { deadlineSystem } from '../apps/deadline/system';
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
    await using run = await startRoom(deadlineSystem, {
      startTime: 5_000,
    });
    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });
    await run.apply(converge);

    await run.apply(dispatch, {
      clientId: 'alice',
      payload: StartDeadline({ durationMs: 50 }),
    });
    const dl = deadlineAt(await readServer(run));

    await run.apply(hold, 'bob');
    await run.apply(passTime, 80);
    expect(await run.observe(clock)).toBeGreaterThanOrEqual(dl);
    await run.apply(dispatch, {
      clientId: 'bob',
      payload: ActBeforeDeadline({}),
    });
    await run.apply(release, 'bob');

    await run.apply(converge);
    expect(deadlineOutcome(await readServer(run))).toBe('expired');
    expect(deadlineOutcome(await readClient(run, 'alice'))).toBe('expired');
    expect(deadlineOutcome(await readClient(run, 'bob'))).toBe('expired');
    await expectHashMatch(run, 'alice');
  });
});
