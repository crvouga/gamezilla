import { describe, expect, test } from 'bun:test';
import { addClient, dispatch } from '../../sim/scenario';
import { deadlineSystem } from '../apps/deadline/system';
import { expectConverged } from '../expect-converged';
import {
  ActBeforeDeadline,
  deadlineOutcome,
  deadlineStatus,
  ExpireDeadline,
  StartDeadline,
} from '../fixtures/deadline-module';
import { openRoom } from '../scenario/open-room';
import {
  expectHashMatch,
  readClient,
  readServer,
} from '../scenario/read-state';

describe('kit: terminal monotonicity (M-F06)', () => {
  test('schedule expire wins; late act / expire are no-ops', async () => {
    await using run = await openRoom(deadlineSystem, {
      startTime: 1_000,
    });
    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });
    await expectConverged(run);

    await run.apply(dispatch, {
      clientId: 'alice',
      payload: StartDeadline({ durationMs: 100 }),
    });
    expect(deadlineStatus(await readServer(run))).toBe('open');
    expect(deadlineStatus(await readClient(run, 'alice'))).toBe('open');

    await run.elapse(120);
    await expectConverged(run);

    const outcome = deadlineOutcome(await readServer(run));
    expect(outcome).toBe('expired');
    expect(deadlineOutcome(await readClient(run, 'alice'))).toBe(outcome);
    expect(deadlineOutcome(await readClient(run, 'bob'))).toBe(outcome);
    await expectHashMatch(run, 'alice');

    await run.apply(dispatch, {
      clientId: 'alice',
      payload: ExpireDeadline({}),
    });
    await run.apply(dispatch, {
      clientId: 'alice',
      payload: ActBeforeDeadline({}),
    });
    expect(deadlineOutcome(await readServer(run))).toBe('expired');
    expect(deadlineOutcome(await readClient(run, 'alice'))).toBe('expired');
  });
});
