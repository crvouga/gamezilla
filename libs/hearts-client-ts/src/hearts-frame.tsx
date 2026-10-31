import {
  decodeHearts,
  seatOfSide,
} from '@libs/hearts-shared-ts/hearts-position';
import { t } from '@lingui/core/macro';
import {
  boardOnly,
  type FramePlayerColor,
  fixedPlayers,
  type GameFrame,
  standingsByScore,
} from '@pkgs/turn-game-shared-ts/game-frame';
import { GAME_SIDES } from '@pkgs/turn-game-shared-ts/game-rules';
import type { JSX } from 'solid-js';
import { HeartsBoard } from './hearts-board';
import { seatProgress, tableCenter } from './hearts-table-view';

/** One player color per seat, in seat order. */
const SEAT_COLORS: readonly FramePlayerColor[] = [1, 2, 3, 4];

/** South, West, North and East: each seat's score, its cards and its deal. */
export const heartsFrame: GameFrame<JSX.Element> = {
  players: fixedPlayers(4),
  options: [],
  seats: {
    look: (side) => ({ color: SEAT_COLORS[GAME_SIDES.indexOf(side)] ?? 1 }),
    stat: (position, side) => {
      const hearts = decodeHearts(position);
      if (hearts === null) return null;
      return {
        label: t`Score`,
        value: String(hearts.scores[seatOfSide(side)] ?? 0),
      };
    },
    facts: (position, side, committed) => {
      const hearts = decodeHearts(position);
      return hearts === null
        ? []
        : seatProgress(hearts, seatOfSide(side), committed);
    },
    out: () => false,
  },
  createBoard: boardOnly(HeartsBoard),
  // The table's own sentence. Whether the viewer has passed is public:
  // they are among the sides that have committed.
  turnStatus: (position, viewer, committed) =>
    tableCenter({
      position,
      committed,
      commitment: viewer !== null && committed.includes(viewer) ? '' : null,
    }) || null,
  // The lowest score wins; a draw (on time) goes to every seat.
  result: (position, winner) => {
    const scores = decodeHearts(position)?.scores ?? [];
    return {
      scoreLabel: t`Score`,
      standings: standingsByScore({
        winner,
        sides: GAME_SIDES,
        score: (side) => scores[seatOfSide(side)] ?? 0,
        best: 'lowest',
      }),
    };
  },
};
