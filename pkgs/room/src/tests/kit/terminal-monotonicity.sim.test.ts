import { describe, expect, test } from 'bun:test';
import { openRoomSimWorld } from '../../sim/world';
import {
  ActBeforeDeadline,
  DeadlineFixtureModule,
  deadlineOutcome,
  deadlineStatus,
  ExpireDeadline,
  StartDeadline,
} from '../fixtures/deadline-module';

describe('kit: terminal monotonicity (M-F06)', () => {
  test('concurrent act vs expire → exactly one outcome', async () => {
    await using world = await openRoomSimWorld({
      seed: process.env['SIM_SEED'] ?? '42',
      module: DeadlineFixtureModule,
      startMs: 1_000,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await world.assertConverged();

    a.dispatch(StartDeadline({ durationMs: 100 }));
    await world.drain();
    expect(deadlineStatus(await world.serverSnapshot())).toBe('open');
    expect(deadlineStatus(a.snapshot())).toBe('open');

    // Advance past deadline; race Act (should reject) vs Expire.
    await world.runFor(120);
    a.dispatch(ActBeforeDeadline({}));
    b.dispatch(ExpireDeadline({}));
    await world.assertConverged();

    const server = await world.serverSnapshot();
    const outcome = deadlineOutcome(server);
    expect(outcome).toBe('expired');
    expect(deadlineOutcome(a.snapshot())).toBe(outcome);
    expect(deadlineOutcome(b.snapshot())).toBe(outcome);
    expect(a.hash()).toBe(await world.serverHash());

    a.dispatch(ExpireDeadline({}));
    a.dispatch(ActBeforeDeadline({}));
    await world.drain();
    expect(deadlineOutcome(await world.serverSnapshot())).toBe('expired');
    expect(deadlineOutcome(a.snapshot())).toBe('expired');
  });
});
