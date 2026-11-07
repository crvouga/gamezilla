import {
  decodeHearts,
  passDirection,
  seatOfSide,
} from '@libs/hearts-shared-ts/hearts-position';
import { t } from '@lingui/core/macro';
import {
  boardOnly,
  type FramePlayerColor,
  fixedPlayers,
  type GameFrame,
  type GameOutlineStep,
  standingsByScore,
} from '@pkgs/turn-game-shared-ts/game-frame';
import { GAME_SIDES } from '@pkgs/turn-game-shared-ts/game-rules';
import type { JSX } from 'solid-js';
import { HeartsBoard } from './hearts-board';
import { heartsSeatName, passHeading, passPlan } from './hearts-copy';
import { tableCenter } from './hearts-table-view';

/** One player color per seat, in seat order. */
const SEAT_COLORS: readonly FramePlayerColor[] = [1, 2, 3, 4];

/**
 * The passing order of the four deals around the one being played (left,
 * right, across, then none), the deal under way marked; nothing once the
 * game is over.
 */
export function heartsOutline(position: string): readonly GameOutlineStep[] {
  const decoded = decodeHearts(position);
  if (decoded === null || decoded.phase === 'done') return [];
  const first = Math.floor((decoded.deal - 1) / 4) * 4 + 1;
  return [0, 1, 2, 3].map((offset) => {
    const deal = first + offset;
    return {
      label: t`Deal ${deal}`,
      detail: passPlan(passDirection(deal)),
      current: deal === decoded.deal,
    };
  });
}

/**
 * South, West, North and East. Each player sits at their place at the
 * table, their tag naming the seat; the table itself says each seat's
 * score, its cards and its deal, so no fact is shown twice.
 */
export const heartsFrame: GameFrame<JSX.Element> = {
  drawOffers: false,
  // Each player sits at their own place at the table, once.
  boardSeats: true,
  players: fixedPlayers(4),
  options: [],
  seats: {
    look: (side) => ({ color: SEAT_COLORS[GAME_SIDES.indexOf(side)] ?? 1 }),
    stat: () => null,
    facts: (_position, side) => [heartsSeatName(side)],
    out: () => false,
  },
  createBoard: boardOnly(HeartsBoard),
  // Beside a wide table before the first card is played, the passing order.
  outline: heartsOutline,
  // The table's own sentence. Whether the viewer has passed is public:
  // they are among the sides that have committed.
  turnStatus: (position, viewer, committed, nameOf) => {
    const decoded = decodeHearts(position);
    return decoded?.phase === 'pass'
      ? passHeading(passDirection(decoded.deal), false)
      : tableCenter(
          {
            position,
            committed,
            commitment:
              viewer !== null && committed.includes(viewer) ? '' : null,
          },
          viewer,
          nameOf
        ) || null;
  },
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
