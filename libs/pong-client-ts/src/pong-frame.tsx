import { PONG_CONFIG } from '@libs/pong-shared-ts/pong-config';
import { pongPositionCodec } from '@libs/pong-shared-ts/pong-game';
import type { PongState } from '@libs/pong-shared-ts/pong-state';
import { t } from '@lingui/core/macro';
import {
  fixedPlayers,
  type GameFrame,
  type GameFrameBoardProps,
  type GameFrameBoardSession,
  standingsByScore,
} from '@pkgs/turn-game-shared-ts/game-frame';
import type { GameSimulationControls } from '@pkgs/turn-game-shared-ts/game-presentation';
import {
  type GameSide,
  TWO_PLAYER_SIDES,
} from '@pkgs/turn-game-shared-ts/game-rules';
import type { JSX } from '@solidjs/web';
import { createMemo } from 'solid-js';
import { PongBoard } from './pong-board';
import { pongStatus } from './pong-board-view';

const paddle = (side: GameSide) => (side === 'white' ? 'left' : 'right');

/**
 * Every frame reader shares one decoded court: a live court is a new
 * position every display frame, read by each seat and the line.
 */
function positionReader(): (position: string) => PongState | null {
  let latest: { position: string; state: PongState | null } | undefined;
  return (position) => {
    if (latest === undefined || latest.position !== position)
      latest = { position, state: pongPositionCodec.decode(position) };
    return latest.state;
  };
}

const readPosition = positionReader();

/** The points each paddle has, from the court's position. */
function points(position: string, side: GameSide): number {
  return readPosition(position)?.score[paddle(side)] ?? 0;
}

/** The points that win the game in `position`. */
function target(position: string): number {
  return readPosition(position)?.targetScore ?? PONG_CONFIG.targetScore;
}

/**
 * The stage's line while this device's paddles cannot move: what holds
 * play up and when it goes on, in place of how to move a paddle. `null`
 * once input is back (or for a watcher, or a finished game), so the turn
 * line's instructions return.
 */
export function pongHeldLine(
  position: string,
  controls: GameSimulationControls | undefined
): string | null {
  if (controls === undefined || (!controls.stale && !controls.paused))
    return null;
  if (readPosition(position)?.phase === 'completed') return null;
  return controls.stale
    ? t`Reconnecting. Your paddle moves again when the game returns.`
    : t`Paused while a player returns.`;
}

/** The court, and the stage's line while play is held up. */
function pongBoard(
  props: GameFrameBoardProps
): GameFrameBoardSession<JSX.Element> {
  const line = createMemo(() => pongHeldLine(props.position, props.simulation));
  return { Board: () => PongBoard(props), actions: () => [], line };
}

/**
 * Left and Right paddles, each seat with its points, and the points that
 * win beside the game's name. The court is the stage's board: full width,
 * centred, with nothing of its own around it that could move it.
 */
export const pongFrame: GameFrame<JSX.Element> = {
  drawOffers: false,
  players: fixedPlayers(2),
  options: [
    {
      kind: 'count',
      id: 'points-to-win',
      label: () => t`Points to win`,
      min: 1,
      max: 99,
      default: PONG_CONFIG.targetScore,
      read: target,
      encode: String,
    },
  ],
  target: (position) => t`First to ${target(position)}`,
  seats: {
    look: (side) => ({ color: side === 'white' ? 1 : 2 }),
    // Each seat's points, live: the opponent's above the court, the
    // person's own below it.
    stat: (position, side) => ({
      label: t`Points`,
      value: String(points(position, side)),
    }),
    facts: () => [],
    out: () => false,
  },
  createBoard: pongBoard,
  // The court owns the serve's count and interruptions; the line says how
  // to play (`pongHeldLine` takes it while the paddles cannot move), and
  // the result once the game is over.
  turnStatus: (position, viewer) => {
    const state = readPosition(position);
    if (state === null) return null;
    if (state.phase === 'completed') return pongStatus(state, undefined);
    return viewer === null
      ? t`Watching the rally.`
      : t`Drag or use the arrow keys to move your paddle.`;
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
