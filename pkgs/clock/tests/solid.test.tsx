/** @jsxImportSource solid-js */

import { describe, expect, test } from 'bun:test';
import { createSimClock } from '@pkgs/clock/sim-clock';
import { ClockProvider, useClock, useTimers } from '@pkgs/clock/solid';
import { render, screen } from '@solidjs/testing-library';
import { createSignal, onCleanup } from 'solid-js';

describe('ClockProvider (solid)', () => {
  test('exposes injected clock and timers', () => {
    const sim = createSimClock({ startMs: 5_000 });
    function Ticker() {
      const clock = useClock();
      const timers = useTimers();
      const [now, setNow] = createSignal(clock.now());
      const handle = timers.setInterval(() => setNow(clock.now()), 1_000);
      onCleanup(() => timers.clearInterval(handle));
      return <output>{now()}</output>;
    }
    render(() => (
      <ClockProvider clock={sim.clock} timers={sim.timers}>
        <Ticker />
      </ClockProvider>
    ));
    expect(screen.getByRole('status')).toHaveTextContent('5000');
    sim.clock.advance(2_000);
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
