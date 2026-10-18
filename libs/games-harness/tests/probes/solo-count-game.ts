/**
 * Probe: a puzzle with no opponent. One person counts on by one or two and
 * solves a puzzle by reaching seven in the moves it allows; nobody replies.
 * Only the first side ever moves. Offers puzzles only.
 *
 * Written as its author means it — every move of a puzzle's line is the
 * solver's — so the adapter is left unchecked here: `puzzle-only.test.ts`
 * shows where the framework refuses it.
 */

import { defineGameClient } from '@libs/game-menu-client/game-client';
import type { HarnessGame } from '@libs/game-session-harness/harness-game';
import type { PuzzleFixture } from '@libs/game-session-harness/known-puzzles';
import { defineTurnGame } from '@libs/game-session-shared/turn-game-definition';
import type {
  PuzzleRecord,
  PuzzlesCapability,
} from '@pkgs/turn-game-shared/game-puzzles';
import type { TurnGameCapabilities } from '@pkgs/turn-game-shared/game-rules';
import { countRules } from './count-rules';
import { buttonBoard, probeAutomation, probePresentation } from './probe-parts';

export const SOLO_COUNT_RULES = countRules({
  id: 'solo-count',
  steps: { one: 1, two: 2 },
  finish: 7,
  next: () => 'white',
  ending: (mover) => ({ winner: mover, reason: 'counted to seven' }),
});

const CELLS = ['0', '1', '2', '3', '4', '5', '6', '7'];

const PUZZLES: PuzzlesCapability = {
  namespace: 'solo-count/',
  content: {
    validate: (record) =>
      record.id.startsWith('solo-count/') &&
      SOLO_COUNT_RULES.recognizes(record.position)
        ? { ok: true }
        : { ok: false, reason: 'id', detail: `${record.id} is not solo` },
  },
  marks: (position, action) => {
    const played = SOLO_COUNT_RULES.play(position, action, '', []);
    if (played === null) return null;
    const count = (p: string) => p.slice('solo-count:'.length, -1);
    return { from: count(position), to: count(played.position) };
  },
  isCell: (cell) => CELLS.includes(cell),
};

const CAPABILITIES = { puzzles: PUZZLES } satisfies TurnGameCapabilities;

const SHARED = defineTurnGame({
  rules: SOLO_COUNT_RULES,
  capabilities: CAPABILITIES,
  automation: probeAutomation(SOLO_COUNT_RULES),
});

const record = (
  id: string,
  position: string,
  line: string[]
): PuzzleRecord => ({
  id: `solo-count/${id}`,
  position,
  line,
  rating: 1450,
  ratingDeviation: 80,
  popularity: 90,
  plays: 10,
  themes: ['short'],
});

/** From three, two and two reach seven: both moves the solver's. */
const TWO_TWOS: PuzzleFixture = {
  record: record('two-twos', 'solo-count:3w', ['two', 'two']),
  solverSide: 'white',
  solution: ['two', 'two'],
  labels: ['two to 5', 'two to 7'],
  wrongMove: { at: 1, action: 'one' },
  refusedMove: { at: 1, action: 'three' },
  opponentMove: { at: 1, action: 'black-one' },
};

export const SOLO_COUNT_GAME: HarnessGame<typeof CAPABILITIES> = {
  label: 'solo count',
  shared: SHARED,
  client: defineGameClient({
    shared: SHARED,
    title: 'Solo count',
    caption: 'Reach seven in the moves allowed',
    subtitle: () => 'Count on by one or two, alone.',
    presentation: probePresentation(SOLO_COUNT_RULES, {
      name: 'Solo count',
      sides: { white: 'Counter', black: 'Nobody' },
      endings: { 'counted to seven': 'Reached seven.' },
    }),
    puzzles: { Board: buttonBoard(SOLO_COUNT_RULES) },
  }),
  fixtures: {
    firstSideVictory: ['one', 'one', 'one', 'one', 'one', 'one', 'one'],
    firstSideVictoryLabels: [1, 2, 3, 4, 5, 6, 7].map(
      (count) => `one to ${String(count)}`
    ),
    refusedOpenings: ['three', ''],
    puzzles: [TWO_TWOS],
  },
  puzzleSounds: {
    'solo-count/move': 'move',
    'solo-count/right': 'correct move',
    'solo-count/wrong': 'wrong move',
    'solo-count/end': 'end',
  },
};
