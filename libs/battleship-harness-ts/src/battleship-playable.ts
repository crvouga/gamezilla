import { battleshipGameShared } from '@libs/battleship-shared-ts/battleship-game';
import type { PlayableGame } from '@libs/game-session-harness-ts/harness-game';
import {
  BLUE_FLEET,
  BLUE_VICTORY,
  BLUE_VICTORY_LABELS,
  RED_FLEET,
} from './battleship-fixtures';

/** What any driver needs to play Battleship; it loads no client code. */
export const BATTLESHIP_PLAYABLE: PlayableGame = {
  label: 'Battleship',
  shared: battleshipGameShared,
  fixtures: {
    setups: { white: BLUE_FLEET, black: RED_FLEET },
    firstSideVictory: BLUE_VICTORY,
    firstSideVictoryLabels: BLUE_VICTORY_LABELS,
    // Off the board, malformed, and an outcome a person cannot claim.
    refusedOpenings: ['k1', 'a11', 'a0', 'f2:hit', ''],
  },
};
