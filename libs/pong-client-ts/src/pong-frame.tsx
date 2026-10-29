import { PONG_CONFIG } from '@libs/pong-shared-ts/pong-config';
import { pongPositionCodec } from '@libs/pong-shared-ts/pong-game';
import { t } from '@lingui/core/macro';
import {
  boardOnly,
  fixedPlayers,
  type GameFrame,
  standingsByScore,
} from '@pkgs/turn-game-shared-ts/game-frame';
import {
  type GameSide,
  TWO_PLAYER_SIDES,
} from '@pkgs/turn-game-shared-ts/game-rules';
import type { JSX } from 'solid-js';
import { PongBoard, pongStatus } from './pong-board';

const paddle = (side: GameSide) => (side === 'white' ? 'left' : 'right');

/** The points each paddle has, from the court's position. */
function points(position: string, side: GameSide): number {
  return pongPositionCodec.decode(position)?.score[paddle(side)] ?? 0;
}

/** Left and Right paddles, their points, and the points that win. */
export const pongFrame: GameFrame<JSX.Element> = {
  players: fixedPlayers(2),
  options: [
    {
      kind: 'count',
      id: 'points-to-win',
      label: () => t`Points to win`,
      min: 1,
      max: 99,
      default: PONG_CONFIG.targetScore,
      read: (position) =>
        pongPositionCodec.decode(position)?.targetScore ??
        PONG_CONFIG.targetScore,
      encode: String,
    },
  ],
  seats: {
    look: (side) => ({ color: side === 'white' ? 1 : 2 }),
    stat: (position, side) => ({
      label: t`Points`,
      value: String(points(position, side)),
    }),
    facts: () => [],
    out: () => false,
  },
  createBoard: boardOnly(PongBoard),
  turnStatus: (position) => {
    const state = pongPositionCodec.decode(position);
    return state === null ? null : pongStatus(state, undefined);
  },
  result: (position, winner) => ({
    scoreLabel: t`Points`,
    standings: standingsByScore({
      winner,
      sides: TWO_PLAYER_SIDES,
      score: (side) => points(position, side),
      best: 'highest',
    }),
  }),
};
