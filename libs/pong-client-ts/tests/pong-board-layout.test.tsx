/** Pong's court on a wide screen and a phone: how to move, and the score once. */

import { afterEach, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

// regression: pong-slider-sideways — a horizontal slider under the court
// moved a paddle that travels up and down. The phone's slider stands
// upright beside the court, on its paddle's side, top to bottom.
test('phone: an upright slider beside the court moves the paddle on its side', () => {
  mount(390);
  const slider = screen.getByTestId('pong-white-control');
  expect(slider.getAttribute('aria-orientation')).toBe('vertical');
  const court = screen.getByTestId('pong');
  // The slider and the court share one row, the slider first (Left's side).
  const row = slider.parentElement;
  expect(row?.contains(court)).toBe(true);
  expect(row?.firstElementChild).toBe(slider);
});

// regression: pong-markers-unmatched — the players' swatches were blue and
// orange while both paddles were drawn in the court's own ink, and nothing
// on the court said which paddle was the person's. Each paddle takes its
// seat's color, and the person's own half says "You".
test("each paddle takes its seat's color and the person's own half says You", () => {
  mount(390);
  expect(
    screen.getByTestId('pong-first-paddle').getAttribute('data-color')
  ).toBe('player1');
  expect(
    screen.getByTestId('pong-second-paddle').getAttribute('data-color')
  ).toBe('player2');
  const drawing = screen.getByTestId('pong-drawing');
  const own = [...drawing.querySelectorAll('text')].filter(
    (text) => text.textContent === 'You'
  );
  expect(own).toHaveLength(1);
  expect(own[0]?.getAttribute('data-side')).toBe('first');
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

const UI_SRC = join(import.meta.dirname, '../../../pkgs/ui-root-client-ts/src');

/** The body of the first rule whose selector is exactly `selector`. */
function rule(file: string, selector: string): string {
  const css = readFileSync(join(UI_SRC, file), 'utf8');
  const open = css.indexOf('{', css.indexOf(`${selector} {`));
  return css.slice(open + 1, css.indexOf('}', open));
}

// regression: pong-phone-court-small — on a phone the court was about
// 305 by 200 px beside a 44px slider column, and its score digits were
// drawn at a third of their colour, too faint to read. The slider column
// is narrow and close, so the court (its shape fixed) takes the width, and
// the digits keep most of their colour.
test('phone: the court takes the width the slider leaves, its score readable', () => {
  mount(390);
  const row = screen.getByTestId('pong-white-control').parentElement;
  expect(row?.className).toContain('gap-ui-xs');
  expect(rule('range-control/range-control.module.css', '.vertical')).toContain(
    'width: 2rem'
  );
  const opacity = /opacity: ([\d.]+)/.exec(
    rule('paddle-court/paddle-court.module.css', '.score')
  )?.[1];
  expect(Number(opacity)).toBeGreaterThanOrEqual(0.7);
});

// regression: pong-slider-stray — on a phone the slider beside the court
// was a bare grey bar with a blue knob, reading as a stray element rather
// than the paddle's control. It is drawn as the paddle's lane: a groove in
// the court's colours whose thumb is a paddle in the seat's colour.
test("phone: the slider beside the court is drawn as its paddle's lane", () => {
  mount(390);
  const control = screen.getByTestId('pong-white-control');
  expect(control.getAttribute('data-paddle')).toBe('player1');
  expect(control.getAttribute('aria-label')).toBe('Left paddle');
  // The thumb (the paddle) has a width of its own: a percentage of an
  // upright range's track resolves to nothing, and the paddle vanished.
  const css = readFileSync(
    join(
      import.meta.dirname,
      '../../../pkgs/ui-root-client-ts/src/range-control/range-control.module.css'
    ),
    'utf8'
  );
  const start = css.indexOf('.vertical[data-paddle]::-webkit-slider-thumb {');
  expect(start).toBeGreaterThan(-1);
  const thumb = css.slice(start, css.indexOf('}', start));
  expect(thumb).toMatch(/width:\s*calc\(/);
  expect(thumb).not.toMatch(/width:\s*100%/);
});

// regression: pong-ball-tiny — the ball was a 20-unit square on a
// 1200-unit court, about 5px across on a phone. It is drawn round and 1.6
// times its playing size, centred where it plays.
test('the ball is drawn round, larger than it plays, centred where it plays', () => {
  mount(390);
  const config = pongConfig();
  const ball = screen.getByTestId('pong-ball');
  expect(ball.tagName.toLowerCase()).toBe('circle');
  expect(Number(ball.getAttribute('r'))).toBe(config.ballRadius * 1.6);
  expect(Number(ball.getAttribute('cx'))).toBe(config.width / 2);
});
