import { describe, expect, test } from 'bun:test';

import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';

describe('createHarnessClock', () => {
  test('clock advance fires setTimeout', () => {
    const { clock, timers } = createHarnessClock({ startMs: 0 });
    let hit = 0;
    timers.setTimeout(() => {
      hit += 1;
    }, 100);
    expect(hit).toBe(0);
    clock.advance(99);
    expect(hit).toBe(0);
    clock.advance(1);
    expect(hit).toBe(1);
  });

  test('clock reset rewinds and drops pending timers', () => {
    const { clock, timers } = createHarnessClock({ startMs: 100 });
    let hit = 0;
    timers.setTimeout(() => {
      hit += 1;
    }, 50);
    clock.reset(20);
    expect(clock.now()).toBe(20);
    clock.advance(100);
    expect(hit).toBe(0);
  });

  test('nextDueAt returns soonest pending timer', () => {
    const { clock, timers } = createHarnessClock({ startMs: 0 });
    expect(clock.nextDueAt()).toBeNull();
    timers.setTimeout(() => undefined, 200);
    timers.setTimeout(() => undefined, 50);
    expect(clock.nextDueAt()).toBe(50);
    clock.advance(50);
    expect(clock.nextDueAt()).toBe(200);
  });

  test('pendingOneShotCount ignores intervals', () => {
    const { clock, timers } = createHarnessClock({ startMs: 0 });
    timers.setInterval(() => undefined, 500);
    expect(clock.pendingOneShotCount()).toBe(0);
    timers.setTimeout(() => undefined, 100);
    timers.setTimeout(() => undefined, 200);
    expect(clock.pendingOneShotCount()).toBe(2);
    clock.advance(100);
    expect(clock.pendingOneShotCount()).toBe(1);
  });
});
