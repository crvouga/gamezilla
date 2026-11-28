import { afterEach, expect, test } from 'bun:test';
import { FrameSeatChipView } from '@libs/game-session-client-ts/game-frame-table-view';
import type { FramePlaySeat } from '@libs/game-session-client-ts/game-frame-view-types';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, screen } from '@solidjs/testing-library';

afterEach(cleanup);

function mountOwn(deciding: boolean, choosing = false): void {
  const time = createHarnessClock();
  const seat: FramePlaySeat = {
    side: 'white',
    sideLabel: 'white',
    holder: { kind: 'person', person: 'white' },
    plainName: 'Avery',
    swatch: { mark: '●' },
    clock: null,
    stat: { label: 'Score', value: '12' },
    state: null,
    standIn: false,
    committed: false,
    choosing,
    facts: [],
    deciding,
    reclaim: false,
  };
  renderWithI18n(() => (
    <ClockProvider clock={time.clock} timers={time.timers}>
      <ThemeProvider colorScheme="dark">
        <FrameSeatChipView seat={seat} own />
      </ThemeProvider>
    </ClockProvider>
  ));
}

function ownChip(deciding: boolean): HTMLElement | null {
  mountOwn(deciding);
  return screen.getByText('You').closest('[data-component="Badge"]');
}

// regression: game-frame-active-own-chip-badge-contrast
// regression: own-seat-you-one-look — the own chip's `You` was filled on
// the turn tint and a pale wash otherwise, unlike every other own seat.
// It is the one filled mark whatever the turn.
test('the own seat chip fills its You badge whatever the turn, legible on the dark turn tint', () => {
  expect(ownChip(true)?.getAttribute('data-tone')).toBe('solid');
  cleanup();
  expect(ownChip(false)?.getAttribute('data-tone')).toBe('solid');
});

// regression: own-chip-you-hidden-on-narrow-chip — the own chip's `You`
// sat last on its facts line, so a narrow chip hid it behind the figure,
// and its secret choice read `You: choosing`, unlike every other seat.
test('the own chip says You after its name, and its choice as every seat does', () => {
  mountOwn(true, true);
  const name = screen.getByTestId('game-session-white-person');
  const you = screen.getByText('You').closest('[data-component="Badge"]');
  expect(you?.parentElement?.contains(name)).toBe(true);
  expect(screen.getByText('Choosing')).toBeInTheDocument();
  expect(screen.queryByText('You: choosing')).toBeNull();
});
