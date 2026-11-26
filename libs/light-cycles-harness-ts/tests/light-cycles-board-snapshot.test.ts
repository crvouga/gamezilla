import { expect, test } from 'bun:test';
import { lightCyclesBoardFacts } from '@libs/light-cycles-harness-ts/light-cycles-board-view';

const BOARD = 'custom-game-board';

function rider(
  index: number,
  x: number,
  y: number,
  heading: string,
  alive = true
): string {
  return `<g class="head" data-rider="${index}" data-testid="${BOARD}-arena-rider-${index}" data-x="${x}" data-y="${y}" data-heading="${heading}" data-next="${heading}" data-alive="${alive}" data-controlled="${index === 0}" data-mark="${'CENV'[index]}" transform="translate(${x + 0.5} ${y + 0.5}) scale(1)"><title>Rider</title></g>`;
}

/** A Trio countdown as a native browser serializes it, one rider already crashed. */
const TRIO_COUNTDOWN = [
  `<div class="arena" data-dimmed="false" data-round="1" data-rider-count="3" data-testid="${BOARD}-arena" aria-label="Arena &amp; &quot;riders&quot;">`,
  `<svg><path data-testid="${BOARD}-arena-trail-0" d="M9 6h2v1h-2z"></path>`,
  rider(0, 10, 6, 'right'),
  rider(1, 30, 21, 'left'),
  rider(2, 30, 6, 'down', false),
  `<g class="crash" data-rider="2" data-testid="${BOARD}-arena-crash-2" data-x="30" data-y="6"></g></svg></div>`,
  `<span data-testid="${BOARD}-score-white" data-score="1"></span>`,
  `<span data-testid="${BOARD}-score-black" data-score="0"></span>`,
  `<span data-testid="${BOARD}-score-red" data-score="2"></span>`,
  `<p data-testid="${BOARD}-round" data-round="1" data-phase="countdown" data-target="3"></p>`,
  `<p data-testid="${BOARD}-status" data-steering="countdown"></p>`,
].join('');

// regression: light-cycles-board-read-outlasts-countdown
test('the whole Light Cycles board is read from one moment of the page', () => {
  expect(lightCyclesBoardFacts(TRIO_COUNTDOWN, BOARD)).toEqual({
    board: BOARD,
    round: 1,
    phase: 'countdown',
    targetScore: 3,
    steering: 'countdown',
    live: true,
    crashes: ['Nova@31,7'],
    riders: [
      {
        name: 'Comet',
        column: 11,
        row: 7,
        heading: 'right',
        next: 'right',
        riding: true,
        steeredHere: true,
        mark: 'C',
        trail: ['10,7', '11,7'],
        score: 1,
      },
      {
        name: 'Ember',
        column: 31,
        row: 22,
        heading: 'left',
        next: 'left',
        riding: true,
        steeredHere: false,
        mark: 'E',
        trail: [],
        score: 0,
      },
      {
        name: 'Nova',
        column: 31,
        row: 7,
        heading: 'down',
        next: 'down',
        riding: false,
        steeredHere: false,
        mark: 'N',
        trail: [],
        score: 2,
      },
    ],
  });
});

test('a page without the arena shows no Light Cycles board', () => {
  expect(lightCyclesBoardFacts('<main></main>', BOARD)).toBeNull();
  expect(lightCyclesBoardFacts(TRIO_COUNTDOWN, 'multiplayer-board')).toBeNull();
});
