import { connectFourGameShared } from '@libs/connect-four-shared-ts/connect-four-game';
import type { PlayableGame } from '@libs/game-session-harness-ts/harness-game';
import { CONNECT_FOUR_FIXTURES } from './connect-four-fixtures';

/** Connect Four as any driver plays it, without its screens. */
export const CONNECT_FOUR_PLAYABLE: PlayableGame = {
  label: 'Connect Four',
  shared: connectFourGameShared,
  fixtures: {
    // Red stacks four in the first column while Yellow plays the second.
    firstSideVictory: ['0', '1', '0', '1', '0', '1', '0'],
    // A move is written as its column, counted from 1 at the left.
    firstSideVictoryLabels: ['1', '2', '1', '2', '1', '2', '1'],
    // There are seven columns, numbered from 0; a column is one digit.
    refusedOpenings: ['7', '-1', '00', 'a'],
    // All 42 cells filled with no four in a row: a full board is a draw.
    drawByRules: CONNECT_FOUR_FIXTURES.draw.map(String),
  },
};
