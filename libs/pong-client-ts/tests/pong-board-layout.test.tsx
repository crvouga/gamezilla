/** Pong's court on a wide screen and a phone: how to move, and the score once. */

import { afterEach, expect, test } from 'bun:test';
import { PongBoardView } from '@libs/pong-client-ts/pong-board-view';
import { pongConfig } from '@libs/pong-shared-ts/pong-config';
import { pongPositionCodec } from '@libs/pong-shared-ts/pong-game';
import { initialPongState } from '@libs/pong-shared-ts/pong-state';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, screen } from '@solidjs/testing-library';

afterEach(cleanup);

function mount(width: number): void {
  renderWithI18n(() => (
    <ThemeProvider colorScheme="dark" fixedLayout={{ width, height: 900 }}>
      <PongBoardView
        position={pongPositionCodec.encode(
          initialPongState(pongConfig(), () => 0)
        )}
        orientation="white"
        interactive={false}
        sound={false}
        syncKey={0}
        testId="pong"
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

// regression: pong-court-chrome-repeated — the court drew its own score
// row and status line over the players' points and the game's turn line,
// then a four-line paragraph and, on a wide screen, the phone's slider.
test('wide: no paddle slider, one short line on keys and the points that win', () => {
  mount(1440);
  expect(screen.queryByTestId('pong-white-control')).toBeNull();
  expect(screen.getByTestId('pong-target').textContent).toBe('First to 11');
  expect(
    screen.getByText(/W and S or the arrow keys move your paddle/)
  ).toBeTruthy();
});

test('phone: the slider stays under the court', () => {
  mount(390);
  expect(screen.getByTestId('pong-white-control')).toBeTruthy();
});

test('the scores and a plain status are said to a listener only', () => {
  mount(1440);
  for (const id of ['pong-score-left', 'pong-score-right', 'pong-status'])
    expect(
      screen.getByTestId(id).closest('[data-component="VisuallyHidden"]')
    ).not.toBeNull();
});

// regression: pong-score-off-court — the score sat only in the players'
// panel beside a bare court (an 8px ball on a flat field). Each side's
// points are drawn large in its own half of the court, behind the play.
test('the court draws each side’s points in its own half', () => {
  mount(1440);
  const first = screen.getByTestId('pong-court-score-first');
  const second = screen.getByTestId('pong-court-score-second');
  expect([first.textContent, second.textContent]).toEqual(['0', '0']);
  expect(Number(first.getAttribute('x'))).toBeLessThan(
    Number(second.getAttribute('x'))
  );
  // Drawn for the eye: the court's drawing is hidden from a listener, who
  // hears the score from the court's own words.
  expect(first.closest('svg')?.getAttribute('aria-hidden')).toBe('true');
  expect(screen.getByTestId('pong-score-left').textContent).toBe('Left 0');
});
