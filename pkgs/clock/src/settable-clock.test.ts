import { describe, expect, test } from 'bun:test';
import { createSettableClock } from './settable-clock';

describe('createSettableClock', () => {
  test('offsets and freezes over the source', () => {
    let source = 1_000;
    const clock = createSettableClock({ now: () => source });
    clock.advance(500);
    expect(clock.now()).toBe(1_500);
    source = 2_000;
    expect(clock.now()).toBe(2_500);
    clock.freeze();
    source = 9_000;
    expect(clock.now()).toBe(2_500);
    clock.set(3_000);
    expect(clock.state()).toEqual({ now: 3_000, frozen: true, offsetMs: 500 });
    clock.unfreeze();
    expect(clock.now()).toBe(3_000);
    clock.reset();
    expect(clock.now()).toBe(9_000);
  });
});
