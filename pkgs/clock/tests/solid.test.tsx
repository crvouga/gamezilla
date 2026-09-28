/** @jsxImportSource solid-js */

import { describe, expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock/harness-clock';
import { ClockProvider, useClock, useTimers } from '@pkgs/clock/solid';
import { render, screen } from '@solidjs/testing-library';
import { createSignal, onCleanup } from 'solid-js';

describe('ClockProvider (solid)', () => {
  test('exposes injected clock and timers', () => {
    const harness = createHarnessClock({ startMs: 5_000 });
    function Ticker() {
      const clock = useClock();
      const timers = useTimers();
      const [now, setNow] = createSignal(clock.now());
      const handle = timers.setInterval(() => setNow(clock.now()), 1_000);
      onCleanup(() => timers.clearInterval(handle));
      return <output>{now()}</output>;
    }
    render(() => (
      <ClockProvider clock={harness.clock} timers={harness.timers}>
        <Ticker />
      </ClockProvider>
    ));
    expect(screen.getByRole('status')).toHaveTextContent('5000');
    harness.clock.advance(2_000);
    expect(screen.getByRole('status')).toHaveTextContent('7000');
  });

  test('throws without a provider', () => {
    function Probe() {
      useClock();
      return <span />;
    }
    expect(() => render(() => <Probe />)).toThrow('Clock: provider missing');
  });
});
