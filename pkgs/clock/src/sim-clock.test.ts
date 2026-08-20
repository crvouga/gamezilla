import { describe, expect, test } from 'bun:test';

import { createSimClock } from './sim-clock';

describe('createSimClock', () => {
  test('clock advance fires setTimeout', () => {
    const { clock, timers } = createSimClock({ startMs: 0 });
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
    const { clock, timers } = createSimClock({ startMs: 100 });
    let hit = 0;
    timers.setTimeout(() => {
      hit += 1;
    }, 50);
    clock.reset(20);
    expect(clock.now()).toBe(20);
    clock.advance(100);
    expect(hit).toBe(0);
  });
});
