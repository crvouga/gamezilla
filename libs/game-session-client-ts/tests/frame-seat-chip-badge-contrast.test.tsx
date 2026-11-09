import { afterEach, expect, test } from 'bun:test';
import { FrameSeatChipView } from '@libs/game-session-client-ts/game-frame-table-view';
import type { FramePlaySeat } from '@libs/game-session-client-ts/game-frame-view-types';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, screen } from '@solidjs/testing-library';

afterEach(cleanup);

function ownChip(deciding: boolean): HTMLElement | null {
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
    choosing: false,
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
  return screen.getByText('You').closest('[data-component="Badge"]');
}

// regression: game-frame-active-own-chip-badge-contrast
test('the active own seat chip fills its You badge on the turn tint in the dark theme', () => {
  expect(ownChip(true)?.getAttribute('data-tone')).toBe('solid');
  cleanup();
  expect(ownChip(false)?.getAttribute('data-tone')).toBe('subtle');
});
