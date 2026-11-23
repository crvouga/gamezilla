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
        seats={[
          { side: 'white', look: { color: 1 }, name: 'avery' },
          { side: 'black', look: { color: 2 }, name: 'jordan_plays' },
        ]}
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
// regression: pong-keyboard-entry-undisclosed
// regression: pong-wide-guidance-asks-for-focus
test('wide: discover court focus, keys and dragging beside the points that win', () => {
  mount(1440);
  expect(screen.queryByTestId('pong-white-control')).toBeNull();
  expect(screen.getByTestId('pong-target').textContent).toBe('First to 11');
  expect(
    screen.getByText(/W and S or the arrow keys move your paddle/)
  ).toBeTruthy();
  // Keys reach the court without focusing it first: no step is asked for.
  expect(screen.queryByText(/Click or Tab/)).toBeNull();
  expect(screen.getByText(/You can also drag up and down/)).toBeTruthy();
});

// regression: pong-slider-sideways — a horizontal slider under the court
// moved a paddle that travels up and down. The phone's slider stands
// upright, top to bottom.
// regression: pong-lane-beside-court — the upright slider then stood in a
// lane of its own beside the court, which read as a layout fault. It lies
// over the person's own half of the court, and a finger drags there.
test("phone: the paddle's upright slider lies over its own half of the court", () => {
  mount(390);
  const slider = screen.getByTestId('pong-white-control');
  expect(slider.getAttribute('aria-orientation')).toBe('vertical');
  expect(slider.getAttribute('data-overlay')).toBe('true');
  const half = slider.parentElement;
  expect(half?.getAttribute('data-side')).toBe('first');
  // The half sits with the court in one stage, over it, not in a row.
  const court = screen.getByTestId('pong');
  expect(half?.parentElement).toBe(court.parentElement);
  expect(rule('paddle-court/paddle-court.module.css', '.half')).toMatch(
    /position:\s*absolute;[\s\S]*width:\s*50%;[\s\S]*pointer-events:\s*none;/
  );
  // Only the person's own paddle has a slider.
  expect(screen.queryByTestId('pong-black-control')).toBeNull();
  expect(
    screen.getByText(/Drag up and down anywhere on the court/)
  ).toBeTruthy();
});

// regression: pong-markers-unmatched — the players' swatches were blue and
// orange while both paddles were drawn in the court's own ink. Each paddle
// takes its seat's color, the color beside the player's name on the stage.
// regression: pong-other-half-unnamed — each player is named once, on their
// seat around the court (see pong-frame-commands), never on the court.
test("each paddle takes its seat's color, and the court names nobody", () => {
  mount(390);
  expect(
    screen.getByTestId('pong-first-paddle').getAttribute('data-color')
  ).toBe('player1');
  expect(
    screen.getByTestId('pong-second-paddle').getAttribute('data-color')
  ).toBe('player2');
  expect(screen.queryByTestId('pong-scoreboard')).toBeNull();
  expect(screen.queryByText('jordan_plays')).toBeNull();
});

test('scores have spoken labels and the serve is visible on the court', () => {
  mount(1440);
  for (const id of ['pong-score-left', 'pong-score-right'])
    expect(
      screen.getByTestId(id).closest('[data-component="VisuallyHidden"]')
    ).not.toBeNull();
  expect(
    screen.getByTestId('pong').contains(screen.getByTestId('pong-status'))
  ).toBe(true);
});

// regression: pong-score-off-court — the score sat only in the players'
// panel beside a bare court. It is on each player's seat, the opponent's
// above the court and the person's own below it (pong-frame-commands).
// regression: pong-score-over-ball-path — the points were drawn in the top
// of each half, where the ball travels. Nothing is drawn over the play: the
// court has no scoreboard, and a listener hears the score from its words.
test('the court draws no score over the play; a listener hears it', () => {
  mount(1440);
  expect(screen.queryByTestId('pong-scoreboard')).toBeNull();
  expect(screen.queryByTestId('pong-court-score-first')).toBeNull();
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
// drawn at a third of their colour, too faint to read. The court takes the
// whole width, and the digits keep most of their colour.
// regression: pong-phone-court-small-again — the court then still shared
// its row with a slider lane, and its paddles were 5px wide. Nothing
// shares its row; each paddle is drawn 2 times its playing width.
test('phone: the court takes the whole width, its paddles and score readable', () => {
  mount(390);
  // The court's stage holds the court and its slider, and no lane beside.
  const stage = screen.getByTestId('pong').parentElement;
  expect(stage?.children).toHaveLength(2);
  expect(stage?.querySelectorAll('input[type="range"]')).toHaveLength(1);
  expect(
    stage?.parentElement?.querySelectorAll('input[type="range"]')
  ).toHaveLength(1);
  const paddle = screen.getByTestId('pong-first-paddle');
  expect(Number(paddle.getAttribute('width'))).toBe(
    pongConfig().paddleWidth * 2
  );
  const opacity = /opacity: ([\d.]+)/.exec(
    rule('paddle-court/paddle-court.module.css', '.score')
  )?.[1];
  expect(Number(opacity)).toBeGreaterThanOrEqual(0.7);
});

// regression: pong-thumb-over-play — a phone's drag happened anywhere on
// the person's half, so the thumb sat over the ball's path. A lane along
// their half's outer edge shows where to drag; the other half has none.
// regression: pong-drag-lane-narrow — that lane went only as far in as the
// paddle, a sliver beside a narrow paddle on a phone. It is now
// thumb-wide, a sixth of the court, still clear of most of the ball's path.
test('phone: a thumb-wide drag lane runs along the outer edge of the person’s own half', () => {
  mount(390);
  const config = pongConfig();
  const lane = screen.getByTestId('pong-first-lane');
  expect(Number(lane.getAttribute('x'))).toBe(0);
  const width = Number(lane.getAttribute('width'));
  expect(width).toBeGreaterThan(config.paddleInset);
  expect(width).toBeGreaterThanOrEqual(config.width / 6);
  expect(width).toBeLessThan(config.width / 4);
  expect(screen.queryByTestId('pong-second-lane')).toBeNull();
});

// regression: pong-slider-stray — on a phone the slider beside the court
// was a bare grey bar with a blue knob, reading as a stray element. Laid
// over its half, it draws nothing but a ring around that half when keys
// focus it: the court is its lane.
test("phone: the paddle's slider draws only a focus ring around its half", () => {
  mount(390);
  const control = screen.getByTestId('pong-white-control');
  expect(control.getAttribute('data-paddle')).toBe('player1');
  expect(control.getAttribute('aria-label')).toBe('Left paddle');
  const thumb = rule(
    'range-control/range-control.module.css',
    '.vertical[data-paddle][data-overlay="true"]::-webkit-slider-thumb'
  );
  expect(thumb).toMatch(/width:\s*0;/);
  expect(
    rule(
      'range-control/range-control.module.css',
      '.vertical[data-paddle][data-overlay="true"]:focus-visible'
    )
  ).toMatch(/outline:\s*2px solid var\(--ui-color-focus-ring\)/);
});

// regression: pong-ball-tiny — the ball was a 20-unit square on a
// 1200-unit court, about 5px across on a phone. It is drawn round and 2.4
// times its playing size, centred where it plays.
// regression: pong-phone-marker-legibility
test('the ball is drawn round, larger than it plays, centred where it plays', () => {
  mount(390);
  const config = pongConfig();
  const ball = screen.getByTestId('pong-ball');
  expect(ball.tagName.toLowerCase()).toBe('circle');
  expect(Number(ball.getAttribute('r'))).toBe(config.ballRadius * 2.4);
  expect(Number(ball.getAttribute('cx'))).toBe(config.width / 2);
});

// regression: pong-drag-lane-unexplained-band — the drag lane drew a
// lighter band down the person's edge of the court at all times, which read
// as a fault in the court. At rest the court is one colour; the lane shows
// only while a thumb is on the court or keys reach the paddle's slider.
test("the drag lane shows only while the court is touched or the paddle's slider has keyboard focus", () => {
  const lane = rule('paddle-court/paddle-court.module.css', '.lane');
  expect(lane).toMatch(/opacity:\s*0;/);
  const css = readFileSync(
    join(UI_SRC, 'paddle-court/paddle-court.module.css'),
    'utf8'
  );
  expect(css).toMatch(
    /\.stage:active \.lane,\s*\.stage:has\(\.half :focus-visible\) \.lane \{\s*opacity: 0\.55;/
  );
});
