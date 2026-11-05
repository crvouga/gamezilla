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
