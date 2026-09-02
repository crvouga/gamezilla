import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/dst';
import { deadlineSystem } from '../apps/deadline/system';
import {
  ActBeforeDeadline,
  deadlineOutcome,
  deadlineStatus,
  ExpireDeadline,
  StartDeadline,
} from '../fixtures/deadline-module';

describe('kit: terminal monotonicity (M-F06)', () => {
  test('schedule expire wins; late act / expire are no-ops', async () => {
    await using host = await openWorld(deadlineSystem, {
      seed: process.env['SIM_SEED'] ?? '42',
      knobs: { clientCount: 0 },
      startTime: 1_000,
    });
    const world = host;
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await world.assertConverged();

    a.dispatch(StartDeadline({ durationMs: 100 }));
    await world.drain();
    expect(deadlineStatus(await world.serverSnapshot())).toBe('open');
    expect(deadlineStatus(a.snapshot())).toBe('open');

    // Advance past deadline; engine Schedule injects Expire.
    await world.runFor(120);
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
