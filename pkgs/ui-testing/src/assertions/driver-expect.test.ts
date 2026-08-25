import { describe, expect, it } from 'bun:test';
import { wallClock, wallTimers } from '@pkgs/clock';

import { runExpectText } from './driver-expect';

describe('runExpectText', () => {
  it('polls text in one loop and flushes via activate after pump', async () => {
    let committed = 'before';
    let pending = 'before';
    let activates = 0;
    let pumps = 0;

    await runExpectText(
      {
        wait: async () => {
          throw new Error('should not wait-visible first when now/timers set');
        },
        getText: async () => committed,
        now: wallClock.now,
        timers: wallTimers,
        pump: () => {
          pumps += 1;
          pending = 'after';
        },
        activate: () => {
          activates += 1;
          committed = pending;
        },
      },
      'label',
      'after',
      { timeoutMs: 500 }
    );

    expect(committed).toBe('after');
    // Up-front activate + one after the miss pump.
    expect(activates).toBe(2);
    expect(pumps).toBe(1);
  });

  it('without pump flushes only inside the predicate', async () => {
    let committed = 'x';
    let activates = 0;

    await runExpectText(
      {
        wait: async () => {
          throw new Error('should not wait-visible first when now/timers set');
        },
        getText: async () => {
          // First activate (inside predicate) commits the value.
          return committed;
        },
        now: wallClock.now,
        timers: wallTimers,
        activate: () => {
          activates += 1;
          committed = 'ready';
        },
      },
      'label',
      'ready',
      { timeoutMs: 500, intervalMs: 1 }
    );

    expect(activates).toBe(1);
  });
});
