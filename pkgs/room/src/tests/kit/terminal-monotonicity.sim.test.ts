import { describe, expect, test } from 'bun:test';
import { addClient, dispatch, roomEpoch } from '../../sim/scenario';
import { deadlineSystem } from '../apps/deadline/system';
import { expectConverged } from '../expect-converged';
import {
  ActBeforeDeadline,
  deadlineOutcome,
  deadlineStatus,
  ExpireDeadline,
  StartDeadline,
} from '../fixtures/deadline-module';
import {
  expectHashMatch,
  readClient,
  readServer,
} from '../scenario/read-state';

describe('kit: terminal monotonicity (M-F06)', () => {
  test('schedule expire wins; late act / expire are no-ops', async () => {
    await using s = await deadlineSystem.script({
      seed: 42,
      host: roomEpoch(deadlineSystem, 1_000),
    });
    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });
    await expectConverged(s);

    await s.apply(dispatch, {
      clientId: 'alice',
      payload: StartDeadline({ durationMs: 100 }),
    });
    expect(deadlineStatus(await readServer(run))).toBe('open');
    expect(deadlineStatus(await readClient(s, 'alice'))).toBe('open');

    await s.elapse(120);
    await expectConverged(s);

    const outcome = deadlineOutcome(await readServer(run));
    expect(outcome).toBe('expired');
    expect(deadlineOutcome(await readClient(s, 'alice'))).toBe(outcome);
    expect(deadlineOutcome(await readClient(s, 'bob'))).toBe(outcome);
    await expectHashMatch(s, 'alice');

    await s.apply(dispatch, {
      clientId: 'alice',
      payload: ExpireDeadline({}),
    });
    await s.apply(dispatch, {
      clientId: 'alice',
      payload: ActBeforeDeadline({}),
    });
    expect(deadlineOutcome(await readServer(run))).toBe('expired');
    expect(deadlineOutcome(await readClient(s, 'alice'))).toBe('expired');
  });
});
