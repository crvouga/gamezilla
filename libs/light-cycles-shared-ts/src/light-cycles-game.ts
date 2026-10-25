import { defineGame } from '@libs/game-session-shared-ts/game-definition';
import type {
  GamePositionRules,
  GameSide,
  GameWinner,
} from '@pkgs/turn-game-shared-ts/game-rules';
import {
  defineSimulation,
  type RegisteredSimulation,
} from '@pkgs/turn-game-shared-ts/game-simulation';
import { lightCyclesAutomation } from './light-cycles-automation';
import { lightCyclesBotInput } from './light-cycles-bot';
import {
  LIGHT_CYCLES_RIDERS,
  LIGHT_CYCLES_SEATS,
  type LightCyclesSeat,
  lightCyclesConfig,
} from './light-cycles-config';
import { parseLightCyclesInput } from './light-cycles-input';
import {
  type LightCyclesMode,
  lightCyclesMode,
  lightCyclesModeConfig,
  lightCyclesPositionCodec,
  lightCyclesStart,
} from './light-cycles-position';
import {
  lightCyclesCheckpointKey,
  lightCyclesPhase,
  lightCyclesResult,
} from './light-cycles-result';
import { retireLightCyclesRider } from './light-cycles-retire';
import { createLightCyclesStep } from './light-cycles-step';

const config = lightCyclesConfig();

/** A seat absent for this long has its rider crash at the next tick boundary. */
export const LIGHT_CYCLES_GRACE_MS = 3000;

export function lightCyclesSideLabel(side: GameSide): string {
  return LIGHT_CYCLES_RIDERS[side as LightCyclesSeat].name;
}

function positionRules(mode: LightCyclesMode): GamePositionRules {
  const codec = lightCyclesPositionCodec(mode);
  const require = (position: string) => {
    const state = codec.decode(position);
    if (state === null) throw new Error('invalid Light Cycles position');
    return state;
  };
  return {
    id: mode.id,
    family: 'light-cycles',
    sides: LIGHT_CYCLES_SEATS[mode.count],
    initial: () => codec.encode(lightCyclesStart(mode, config.targetScore)),
    recognizes: (position) => codec.decode(position) !== null,
    configuration: {
      apply: (position, choice) => {
        if (!/^[1-9]$/.test(choice)) return null;
        require(position);
        return codec.encode(lightCyclesStart(mode, Number(choice)));
      },
      restart: (position) =>
        codec.encode(lightCyclesStart(mode, require(position).targetScore)),
    },
  };
}

function simulationOf(mode: LightCyclesMode): RegisteredSimulation {
  const modeConfig = lightCyclesModeConfig(mode);
  const step = createLightCyclesStep(modeConfig);
  const bot = lightCyclesBotInput(modeConfig);
  return defineSimulation(
    {
      initialize: () => lightCyclesStart(mode, config.targetScore),
      step,
      parseInput: parseLightCyclesInput,
      result: lightCyclesResult,
      phase: lightCyclesPhase,
      checkpointKey: lightCyclesCheckpointKey,
    },
    lightCyclesPositionCodec(mode),
    {
      tickRate: config.tickRate,
      snapshotRate: config.snapshotRate,
      maxCatchUpTicks: config.maxCatchUpTicks,
      maxQueuedInputs: config.maxQueuedInputs,
      maxInputLeadTicks: config.maxInputLeadTicks,
    },
    {
      bots: { input: bot },
      // A turn is a discrete command: every one counts, in arrival order.
      input: { mode: 'commands', maxPendingPerPlayer: 4, maxAgeTicks: 30 },
      rounds: {
        current: (state) => state.round,
        ofInput: (input) => input.round,
      },
      disconnection: {
        policy: 'continue',
        graceMs: LIGHT_CYCLES_GRACE_MS,
        retire: retireLightCyclesRider,
      },
    }
  );
}

function record(mode: LightCyclesMode) {
  const codec = lightCyclesPositionCodec(mode);
  return (
    position: string,
    _history: string,
    metadata: {
      readonly participants: readonly {
        readonly name: string;
        readonly rating: string | null;
      }[];
      readonly outcome: GameWinner;
      readonly reason: string | null;
    }
  ) => {
    const state = codec.decode(position);
    return JSON.stringify({
      game: mode.id,
      participants: metadata.participants,
      outcome: metadata.outcome,
      reason: metadata.reason,
      scores: state?.scores ?? null,
      rounds: state?.round ?? null,
      targetScore: state?.targetScore ?? null,
    });
  };
}

/** One registered mode; the product registers three, a model check may define a small one. */
export function defineLightCyclesMode(mode: LightCyclesMode) {
  const simulation = simulationOf(mode);
  const id = mode.id;
  const count = mode.count;
  return defineGame({
    rules: positionRules(mode),
    simulation,
    continuousAutomation: lightCyclesAutomation(simulation),
    capabilities: {
      'custom-games': {
        bots: { difficulties: ['easy', 'medium', 'hard'] },
        // Two people can share one keyboard: arrows and W, A, S, D.
        ...(count === 2 ? { localPlayers: true as const } : {}),
      },
      matchmaking: {
        namespace: `${id}/`,
        notice: {
          side: lightCyclesSideLabel,
          ending: (reason) =>
            reason === 'target score'
              ? 'The target score was reached.'
              : reason === 'round limit'
                ? 'The 15th round was played.'
                : undefined,
        },
      },
      history: { record: record(mode) },
    },
  });
}

/** Light Cycles supplies arena mechanics; the framework owns sessions, rooms and transport. */
export const lightCyclesDuelShared = defineLightCyclesMode(lightCyclesMode(2));
export const lightCyclesTrioShared = defineLightCyclesMode(lightCyclesMode(3));
export const lightCyclesQuadShared = defineLightCyclesMode(lightCyclesMode(4));
