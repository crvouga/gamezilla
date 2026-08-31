import { describe, expect, test } from 'bun:test';
import { openWorld } from '../../sim/world';
import {
  ActBeforeDeadline,
  DeadlineFixtureModule,
  deadlineAt,
  deadlineOutcome,
  StartDeadline,
} from '../fixtures/deadline-module';

describe('kit: deadline vs action (M-F07)', () => {
  test('partitioned lagging client cannot win after deadline', async () => {
    await using world = await openWorld({
      seed: process.env['SIM_SEED'] ?? '42',
      module: DeadlineFixtureModule,
      startMs: 5_000,
    });
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
