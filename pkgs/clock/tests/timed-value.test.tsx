/** @jsxImportSource solid-js */
/**
 * A time-dependent value re-reads itself at the instant it changes, with one
 * timer and no polling.
 */
// regression: grace-end-never-reached-open-screen
import { describe, expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock';
import { ClockProvider, createTimedValue } from '@pkgs/clock/solid';
import { render } from '@solidjs/testing-library';
import type { Accessor } from 'solid-js';

const LAPSE_MS = 1_000;

describe('createTimedValue', () => {
  test('a value that lapses at a known instant updates then, without a nudge', () => {
    const { clock, timers } = createHarnessClock({ startMs: 0 });
    let read: Accessor<string> = () => 'unset';
    function Probe() {
      read = createTimedValue(
        (nowMs) => (nowMs < LAPSE_MS ? 'paid' : 'free'),
        (value) => (value === 'paid' ? LAPSE_MS : null)
      );
      return <span>{read()}</span>;
    }
    render(() => (
      <ClockProvider clock={clock} timers={timers}>
        <Probe />
      </ClockProvider>
    ));
    expect(read()).toBe('paid');
    clock.advance(LAPSE_MS - 1);
    expect(read()).toBe('paid');
    expect(clock.pendingOneShotCount()).toBe(1);
    clock.advance(1);
    expect(read()).toBe('free');
    // Time alone never changes it again: no timer is left behind.
    expect(clock.pendingOneShotCount()).toBe(0);
  });
});
