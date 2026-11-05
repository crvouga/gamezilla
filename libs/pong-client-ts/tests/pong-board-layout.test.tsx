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
  expect(screen.getByText(/Drag up and down along your edge/)).toBeTruthy();
});

// regression: pong-markers-unmatched — the players' swatches were blue and
// orange while both paddles were drawn in the court's own ink, and nothing
// on the court said which paddle was the person's. Each paddle takes its
// seat's color, and the person's own half says "You".
// regression: pong-other-half-unnamed — only the person's own half was
// named. The other half names the player there.
test("each paddle takes its seat's color and each half names who plays it", () => {
  mount(390);
  expect(
    screen.getByTestId('pong-first-paddle').getAttribute('data-color')
  ).toBe('player1');
  expect(
    screen.getByTestId('pong-second-paddle').getAttribute('data-color')
  ).toBe('player2');
  const drawing = screen.getByTestId('pong-drawing');
  const marks = [...drawing.querySelectorAll('text[data-own]')].map((text) => [
    text.getAttribute('data-side'),
    text.getAttribute('data-own'),
    text.textContent,
  ]);
  expect(marks).toEqual([
    ['first', 'true', 'You'],
    ['second', 'false', 'jordan_plays'],
  ]);
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
// drawn at a third of their colour, too faint to read. The court takes the
// whole width, and the digits keep most of their colour.
// regression: pong-phone-court-small-again — the court then still shared
// its row with a slider lane, and its paddles were 5px wide. Nothing
// shares its row; each paddle is drawn 1.5 times its playing width.
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
    pongConfig().paddleWidth * 1.5
  );
  const opacity = /opacity: ([\d.]+)/.exec(
    rule('paddle-court/paddle-court.module.css', '.score')
  )?.[1];
  expect(Number(opacity)).toBeGreaterThanOrEqual(0.7);
});

// regression: pong-score-muted-on-court — the points were the court's muted
// violet at 72% on its dark violet, the main fact on the court read as
// decoration, and the side names were set larger than the points. The
// points take the court's bright ink, and each side's name sits small
// under its points.
test('the score is drawn in the court’s bright ink, each side named small under it', () => {
  mount(390);
  const score = rule('paddle-court/paddle-court.module.css', '.score');
  expect(score).toMatch(/fill:\s*var\(--ui-color-text\);/);
  expect(Number(/opacity: ([\d.]+)/.exec(score)?.[1])).toBeGreaterThanOrEqual(
    0.9
  );
  const first = screen.getByTestId('pong-court-score-first');
  const mark = screen
    .getByTestId('pong-drawing')
    .querySelector('text[data-side="first"][data-own]');
  if (mark === null) throw new Error('no side name');
  const size = (text: Element) => Number(text.getAttribute('font-size'));
  expect(size(mark)).toBeLessThan(size(first) / 2);
  // Under its points: below them, and in the same half.
  expect(Number(mark.getAttribute('y'))).toBeGreaterThanOrEqual(
    Number(first.getAttribute('y')) + size(first)
  );
  expect(mark.getAttribute('x')).toBe(first.getAttribute('x'));
});

// regression: pong-thumb-over-play — a phone's drag happened anywhere on
// the person's half, so the thumb sat over the ball's path. A slim lane
// along their half's outer edge, as far in as the paddle, shows where to
// drag; the other half has none.
test('phone: a slim drag lane runs along the outer edge of the person’s own half', () => {
  mount(390);
  const config = pongConfig();
  const lane = screen.getByTestId('pong-first-lane');
  expect(Number(lane.getAttribute('x'))).toBe(0);
  const width = Number(lane.getAttribute('width'));
  expect(width).toBeGreaterThan(config.paddleInset);
  expect(width).toBeLessThan(config.width / 10);
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
// 1200-unit court, about 5px across on a phone. It is drawn round and 1.8
// times its playing size, centred where it plays.
test('the ball is drawn round, larger than it plays, centred where it plays', () => {
  mount(390);
  const config = pongConfig();
  const ball = screen.getByTestId('pong-ball');
  expect(ball.tagName.toLowerCase()).toBe('circle');
  expect(Number(ball.getAttribute('r'))).toBe(config.ballRadius * 1.8);
  expect(Number(ball.getAttribute('cx'))).toBe(config.width / 2);
});
