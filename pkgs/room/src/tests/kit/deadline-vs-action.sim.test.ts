import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { deadlineSystem } from '../apps/deadline/system';
import {
  ActBeforeDeadline,
  deadlineAt,
  deadlineOutcome,
  StartDeadline,
} from '../fixtures/deadline-module';

describe('kit: deadline vs action (M-F07)', () => {
  test('partitioned lagging client cannot win after deadline', async () => {
    await using host = await openWorld(deadlineSystem, {
      seed: process.env['SIM_SEED'] ?? '42',
      knobs: { clientCount: 0 },
      startMs: 5_000,
    });
    const world = host.facade;
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await world.assertConverged();

    a.dispatch(StartDeadline({ durationMs: 50 }));
    await world.drain();
    const dl = deadlineAt(await world.serverSnapshot());

    {
      using _hold = world.net('bob').set('hold');
      // Engine Schedule wake expires without client Expire dispatch.
      await world.runFor(80);
      expect(world.clock.now()).toBeGreaterThanOrEqual(dl);
      // Bob still sees old open state locally while held.
      b.dispatch(ActBeforeDeadline({}));
      await world.drain();
    }

    await world.assertConverged();
    expect(deadlineOutcome(await world.serverSnapshot())).toBe('expired');
    expect(deadlineOutcome(a.snapshot())).toBe('expired');
    expect(deadlineOutcome(b.snapshot())).toBe('expired');
    expect(a.hash()).toBe(await world.serverHash());
  });
});
