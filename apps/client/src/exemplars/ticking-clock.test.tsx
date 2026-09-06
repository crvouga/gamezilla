/** @jsxImportSource solid-js */
import { createSimClock, type SimClockBundle } from '@pkgs/clock/sim-clock';
import { screen } from '@solidjs/testing-library';
import { describe, expect, test } from 'vitest';
import { renderWithI18n } from '../../tests/support/render';
import { ClockProvider } from './clock-context';
import { TickingClock } from './ticking-clock';

function renderClock(bundle: SimClockBundle, intervalMs?: number) {
  return renderWithI18n(() => (
    <ClockProvider clock={bundle.clock} timers={bundle.timers}>
      <TickingClock intervalMs={intervalMs} />
    </ClockProvider>
  ));
}

describe('TickingClock', () => {
  test('reads injected time and advances with the injected interval', () => {
    const bundle = createSimClock({ startMs: 5_000 });
    renderClock(bundle);
    const out = screen.getByTestId('ticking-clock');
    expect(out).toHaveTextContent('Elapsed: 5s');

    bundle.clock.advance(2_500);
    expect(out).toHaveTextContent('Elapsed: 7s');
  });

  test('clears the interval on unmount', () => {
    const bundle = createSimClock();
    const { unmount } = renderClock(bundle, 100);
    expect(bundle.clock.nextDueAt()).toBe(100);
    unmount();
    expect(bundle.clock.nextDueAt()).toBeNull();
  });

  test('fails loudly without a ClockProvider', () => {
    expect(() => renderWithI18n(() => <TickingClock />)).toThrow(
      'useClockServices must be used within ClockProvider'
    );
  });
});
