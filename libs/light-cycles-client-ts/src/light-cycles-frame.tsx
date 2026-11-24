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
  type FrameBoardPaint,
  type GameFrame,
  type GameFrameAction,
  type GameFrameBoardProps,
  type GameFrameBoardSession,
  standingsByScore,
} from '@pkgs/turn-game-shared-ts/game-frame';
import type { GameSimulationControls } from '@pkgs/turn-game-shared-ts/game-presentation';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import type { JSX } from '@solidjs/web';
import { createMemo } from 'solid-js';
import { LightCyclesBoard } from './light-cycles-board';
import { decodeLightCycles } from './light-cycles-board-view';
import { riderName, steeringLine } from './light-cycles-view';

/**
 * Each rider's paint: its trail's own, so the marker beside a player's name
 * is the colour of the trail they ride (cyan, orange, violet, white).
 */
const RIDER_COLORS: Readonly<Record<LightCyclesSeat, FrameBoardPaint>> = {
  white: 'trail-one',
  black: 'trail-two',
  red: 'trail-three',
  blue: 'trail-four',
};

/** The round wins of the rider on `side`. */
function roundWins(state: LightCyclesState | null, side: GameSide): number {
  if (state === null) return 0;
  return state.scores[state.seats.indexOf(side as LightCyclesSeat)] ?? 0;
}

/**
 * The round, the game's line beside a board with no words of its own (the
 * round wins to win are beside the game's name; while the game is played
 * the arena's own line, `steeringLine`, says more).
 */
function arenaStatus(state: LightCyclesState): string {
  return t`Round ${state.round}`;
}

/**
 * The person rides from another of their devices: the stage's commands
 * offer to ride from this one. Read from the controls alone, never the
 * position, so the commands are not rebuilt every frame.
 */
function rideHere(
  controls: GameSimulationControls | undefined
): GameFrameAction[] {
  const claim = controls?.claim;
  const own = controls?.sides[0] ?? controls?.elsewhere?.[0];
  if (claim === undefined || own === undefined) return [];
  if (controls?.elsewhere?.includes(own) !== true) return [];
  return [
    {
      id: 'ride-here',
      label: t`Ride from this device`,
      enabled: true,
      run: () => claim(),
    },
  ];
}

/**
 * The arena; riding from this device among the stage's commands; and the
 * arena's own line (the round, who rides, a round's winner) for the
 * stage's one status line, reworded only when its words change.
 */
function lightCyclesBoard(
  props: GameFrameBoardProps,
  readPosition: (position: string) => LightCyclesState | null
): GameFrameBoardSession<JSX.Element> {
  const line = createMemo(() => {
    const state = readPosition(props.position);
    return state === null ? null : steeringLine(state, props.simulation);
  });
  return {
    Board: () => LightCyclesBoard(props),
    actions: () => rideHere(props.simulation),
    line,
  };
}

/** Every frame reader shares one validated snapshot; retain at most one position. */
function positionReader() {
  let latest: { position: string; state: LightCyclesState | null } | undefined;
  return (position: string): LightCyclesState | null => {
    if (latest === undefined || latest.position !== position)
      latest = { position, state: decodeLightCycles(position) };
    return latest.state;
  };
}

/**
 * Two, three or four riders, each table size its own mode; beside each
 * rider its round wins, out once it has crashed this round.
 */
export function lightCyclesFrame(
  count: LightCyclesRiderCount
): GameFrame<JSX.Element> {
  const sides = LIGHT_CYCLES_SEATS[count];
  const readPosition = positionReader();
  return {
    drawOffers: false,
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
          readPosition(position)?.targetScore ??
          LIGHT_CYCLES_CONFIG.targetScore,
        encode: String,
      },
    ],
    seats: {
      look: (side) => ({
        color: RIDER_COLORS[side as LightCyclesSeat],
        mark: LIGHT_CYCLES_RIDERS[side as LightCyclesSeat].mark,
      }),
      // Short, so a player's name keeps its room on a strip or a chip.
      stat: (position, side) => ({
        label: t`${riderName(side)} wins`,
        value: String(roundWins(readPosition(position), side)),
      }),
      facts: () => [],
      out: (position, side) => {
        const state = readPosition(position);
        return (
          state !== null &&
          state.phase !== 'completed' &&
          state.riders.find((rider) => rider.seat === side)?.alive === false
        );
      },
    },
    target: (position) =>
      t`First to ${readPosition(position)?.targetScore ?? LIGHT_CYCLES_CONFIG.targetScore}`,
    createBoard: (props) => lightCyclesBoard(props, readPosition),
    turnStatus: (position) => {
      const state = readPosition(position);
      return state === null ? null : arenaStatus(state);
    },
    result: (position, winner) => {
      const state = readPosition(position);
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
