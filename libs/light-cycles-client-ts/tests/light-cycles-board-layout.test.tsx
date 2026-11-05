/** Light Cycles' arena on a wide screen and a phone: how to steer, and the scores once. */

import { afterEach, expect, test } from 'bun:test';
import { LightCyclesBoardView } from '@libs/light-cycles-client-ts/light-cycles-board-view';
import { lightCyclesConfig } from '@libs/light-cycles-shared-ts/light-cycles-config';
import { lightCyclesPositionCodec } from '@libs/light-cycles-shared-ts/light-cycles-position';
import { initialLightCyclesState } from '@libs/light-cycles-shared-ts/light-cycles-state';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, screen } from '@solidjs/testing-library';

afterEach(cleanup);

const POSITION = lightCyclesPositionCodec(3).encode(
  initialLightCyclesState(lightCyclesConfig(), ['white', 'black', 'red'])
);

function mount(width: number): void {
  renderWithI18n(() => (
    <ThemeProvider colorScheme="dark" fixedLayout={{ width, height: 900 }}>
      <LightCyclesBoardView
        position={POSITION}
        orientation="white"
        interactive={false}
        sound={false}
        syncKey={0}
        testId="arena"
        setup={null}
        hand={null}
        committed={[]}
        commitment={null}
        onAction={() => undefined}
        simulation={{
          paused: false,
          stale: false,
          sides: ['white'],
          onInput: () => undefined,
          onRelease: () => undefined,
        }}
      />
    </ThemeProvider>
  ));
}

// regression: light-cycles-pad-on-desktop — a wide screen drew the phone's
// direction pad under a long paragraph, running off the window's foot.
test('wide: no direction pad, one line on steering by keys', () => {
  mount(1440);
  expect(screen.queryByTestId('arena-white-pad-up')).toBeNull();
  expect(
    screen.getByText(/Steer with the arrow keys or W, A, S and D/)
  ).toBeTruthy();
});

test('phone: the direction pad is under the arena, with a line on swiping', () => {
  mount(390);
  expect(screen.getByTestId('arena-white-pad-up')).toBeTruthy();
  expect(screen.getByText(/Swipe the arena or use the pad/)).toBeTruthy();
});

// regression: light-cycles-scores-twice — every rider's round wins showed
// over the arena as well as on each player's strip.
test('the scores and the round are said to a listener, not drawn over the arena again', () => {
  mount(1440);
  for (const id of ['arena-score-white', 'arena-round']) {
    const hidden = screen
      .getByTestId(id)
      .closest('[data-component="VisuallyHidden"]');
    expect(hidden).not.toBeNull();
  }
});

// regression: light-cycles-pad-off-screen — on a phone the 64px direction
// pad (about 230px with its rider's name over it) ran past the bottom of
// the screen under the arena. One rider's pad is a compact thumb pad beside
// how to steer, its rider already named above the arena.
test('phone: one rider steers from a compact pad beside the steering line', () => {
  mount(390);
  const pad = screen.getByTestId('arena-white-pad');
  expect(pad.getAttribute('data-size')).toBe('compact');
  const hint = screen.getByText(/Swipe the arena or use the pad to steer/);
  // The pad and the line share one row under the arena: the nearest box
  // holding both is a row, not the arena's column.
  let shared = pad.parentElement;
  while (shared !== null && !shared.contains(hint))
    shared = shared.parentElement;
  expect(shared?.getAttribute('data-component')).toBe('StackHorizontal');
  expect(pad.parentElement?.textContent).not.toContain('Comet');
});
