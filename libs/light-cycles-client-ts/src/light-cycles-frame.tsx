import {
  LIGHT_CYCLES_CONFIG,
  LIGHT_CYCLES_RIDERS,
  LIGHT_CYCLES_SEATS,
  type LightCyclesRiderCount,
  type LightCyclesSeat,
} from '@libs/light-cycles-shared-ts/light-cycles-config';
import {
  lightCyclesDuelShared,
  lightCyclesQuadShared,
  lightCyclesTrioShared,
} from '@libs/light-cycles-shared-ts/light-cycles-game';
import type { LightCyclesState } from '@libs/light-cycles-shared-ts/light-cycles-state';
import { t } from '@lingui/core/macro';
import {
  boardOnly,
  type FramePlayerColor,
  type GameFrame,
  standingsByScore,
} from '@pkgs/turn-game-shared-ts/game-frame';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import type { JSX } from 'solid-js';
import { decodeLightCycles, LightCyclesBoard } from './light-cycles-board';
import { arenaOverlay } from './light-cycles-view';

/** Each rider's color in the arena: blue, orange, purple and green. */
const RIDER_COLORS: Readonly<Record<LightCyclesSeat, FramePlayerColor>> = {
  white: 1,
  black: 2,
  red: 4,
  blue: 8,
};

/** The round wins of the rider on `side`. */
function roundWins(state: LightCyclesState | null, side: GameSide): number {
  if (state === null) return 0;
  return state.scores[state.seats.indexOf(side as LightCyclesSeat)] ?? 0;
}

/** The round under way, or how the last round or the game ended. */
function arenaStatus(state: LightCyclesState): string {
  const ended = state.phase === 'round-over' || state.phase === 'completed';
  const overlay = ended ? arenaOverlay(state) : undefined;
  return (
    overlay?.title ?? t`Round ${state.round} · first to ${state.targetScore}`
  );
}

/**
 * Two, three or four riders, each table size its own mode; beside each
 * rider its round wins, out once it has crashed this round.
 */
export function lightCyclesFrame(
  count: LightCyclesRiderCount
): GameFrame<JSX.Element> {
  const sides = LIGHT_CYCLES_SEATS[count];
  return {
    players: {
      min: 2,
      max: 4,
      default: count,
      modes: {
        2: lightCyclesDuelShared.id,
        3: lightCyclesTrioShared.id,
        4: lightCyclesQuadShared.id,
      },
    },
    options: [
      {
        kind: 'count',
        id: 'target-score',
        label: () => t`Round wins to win`,
        min: 1,
        max: 9,
        default: LIGHT_CYCLES_CONFIG.targetScore,
        read: (position) =>
          decodeLightCycles(position)?.targetScore ??
          LIGHT_CYCLES_CONFIG.targetScore,
        encode: String,
      },
    ],
    seats: {
      look: (side) => ({
        color: RIDER_COLORS[side as LightCyclesSeat],
        mark: LIGHT_CYCLES_RIDERS[side as LightCyclesSeat].mark,
      }),
      stat: (position, side) => ({
        label: t`Round wins`,
        value: String(roundWins(decodeLightCycles(position), side)),
      }),
      facts: () => [],
      out: (position, side) => {
        const state = decodeLightCycles(position);
        return (
          state !== null &&
          state.phase !== 'completed' &&
          state.riders.find((rider) => rider.seat === side)?.alive === false
        );
      },
    },
    createBoard: boardOnly(LightCyclesBoard),
    turnStatus: (position) => {
      const state = decodeLightCycles(position);
      return state === null ? null : arenaStatus(state);
    },
    result: (position, winner) => {
      const state = decodeLightCycles(position);
      return {
        scoreLabel: t`Round wins`,
        standings: standingsByScore({
          winner,
          sides,
          score: (side) => roundWins(state, side),
          best: 'highest',
        }),
      };
    },
  };
}
