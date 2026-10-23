import type { PlayableGame } from '@libs/game-session-harness-ts/harness-game';
import {
  quoridorGameShared,
  quoridorHillGameShared,
} from '@libs/quoridor-shared-ts/quoridor-game';

const CLASSIC_VICTORY = [
  'e2',
  'd9',
  'e3',
  'd8',
  'e4',
  'd7',
  'e5',
  'd6',
  'e6',
  'd5',
  'e7',
  'd4',
  'e8',
  'd3',
  'e9',
] as const;
const HILL_VICTORY = [
  'e2',
  'a4',
  'e8',
  'i4',
  'e3',
  'a3',
  'e7',
  'i3',
  'e4',
  'a2',
  'e6',
  'i2',
  'e5',
] as const;

export const QUORIDOR_PLAYABLE: PlayableGame = {
  label: 'Classic Quoridor',
  shared: quoridorGameShared,
  fixtures: {
    firstSideVictory: CLASSIC_VICTORY,
    firstSideVictoryLabels: CLASSIC_VICTORY,
    refusedOpenings: ['e3', 'j1', 'a9h', ''],
  },
};

export const QUORIDOR_HILL_PLAYABLE: PlayableGame = {
  label: 'Four-Player King of the Hill',
  shared: quoridorHillGameShared,
  fixtures: {
    firstSideVictory: HILL_VICTORY,
    firstSideVictoryLabels: HILL_VICTORY,
    refusedOpenings: ['e3', 'j1', 'a9h', ''],
  },
};
