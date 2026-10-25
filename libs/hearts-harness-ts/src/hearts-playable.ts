import type { PlayableGame } from '@libs/game-session-harness-ts/harness-game';
import { heartsGameShared } from '@libs/hearts-shared-ts/hearts-game';
import {
  KNOWN_DRAWS,
  KNOWN_HIDDEN,
  SOUTH_VICTORY,
  SOUTH_VICTORY_LABELS,
} from './hearts-known-match';
import { NORTH_ALONE, SOUTH_AND_NORTH_SHARE } from './hearts-shared-victories';

/** What any driver needs to play Hearts; it loads no client code. */
export const HEARTS_PLAYABLE: PlayableGame = {
  label: 'Hearts',
  shared: heartsGameShared,
  fixtures: {
    knownDeal: { draws: KNOWN_DRAWS, hidden: KNOWN_HIDDEN },
    firstSideVictory: SOUTH_VICTORY,
    firstSideVictoryLabels: SOUTH_VICTORY_LABELS,
    sharedVictories: { shared: SOUTH_AND_NORTH_SHARE, alone: NORTH_ALONE },
    // A card while every player passes, the authority's own record of a
    // pass, a pass of no cards and nothing at all.
    refusedOpenings: ['2C', 'pass:white', 'commit:', ''],
  },
};
