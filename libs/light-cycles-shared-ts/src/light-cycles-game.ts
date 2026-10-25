import { defineGame } from '@libs/game-session-shared-ts/game-definition';
import type {
  GamePositionRules,
  GameSide,
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
  type LightCyclesRiderCount,
  type LightCyclesSeat,
  lightCyclesConfig,
} from './light-cycles-config';
import { parseLightCyclesInput } from './light-cycles-input';
import {
  LIGHT_CYCLES_MODES,
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
const step = createLightCyclesStep(config);
const bot = lightCyclesBotInput(config);

/** A seat absent for this long has its rider crash at the next tick boundary. */
export const LIGHT_CYCLES_GRACE_MS = 3000;

export function lightCyclesSideLabel(side: GameSide): string {
  return LIGHT_CYCLES_RIDERS[side as LightCyclesSeat].name;
}

function positionRules(count: LightCyclesRiderCount): GamePositionRules {
  const codec = lightCyclesPositionCodec(count);
  const require = (position: string) => {
    const state = codec.decode(position);
    if (state === null) throw new Error('invalid Light Cycles position');
    return state;
  };
  return {
    id: LIGHT_CYCLES_MODES[count],
    family: 'light-cycles',
    sides: LIGHT_CYCLES_SEATS[count],
    initial: () => codec.encode(lightCyclesStart(count, config.targetScore)),
    recognizes: (position) => codec.decode(position) !== null,
    configuration: {
      apply: (position, choice) => {
        if (!/^[1-9]$/.test(choice)) return null;
        require(position);
        return codec.encode(lightCyclesStart(count, Number(choice)));
      },
      restart: (position) =>
        codec.encode(lightCyclesStart(count, require(position).targetScore)),
    },
  };
}

function simulationOf(count: LightCyclesRiderCount): RegisteredSimulation {
  return defineSimulation(
    {
      initialize: () => lightCyclesStart(count, config.targetScore),
      step,
      parseInput: parseLightCyclesInput,
      result: lightCyclesResult,
      phase: lightCyclesPhase,
      checkpointKey: lightCyclesCheckpointKey,
    },
    lightCyclesPositionCodec(count),
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

function record(count: LightCyclesRiderCount) {
  const codec = lightCyclesPositionCodec(count);
  return (
    position: string,
    _history: string,
    metadata: {
      readonly participants: readonly {
        readonly name: string;
        readonly rating: string | null;
      }[];
      readonly outcome: string;
      readonly reason: string | null;
    }
  ) => {
    const state = codec.decode(position);
    return JSON.stringify({
      game: LIGHT_CYCLES_MODES[count],
      participants: metadata.participants,
      outcome: metadata.outcome,
      reason: metadata.reason,
      scores: state?.scores ?? null,
      rounds: state?.round ?? null,
      targetScore: state?.targetScore ?? null,
    });
  };
}

function definition(count: LightCyclesRiderCount) {
  const simulation = simulationOf(count);
  const id = LIGHT_CYCLES_MODES[count];
  return defineGame({
    rules: positionRules(count),
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
      history: { record: record(count) },
    },
  });
}

/** Light Cycles supplies arena mechanics; the framework owns sessions, rooms and transport. */
export const lightCyclesDuelShared = definition(2);
export const lightCyclesTrioShared = definition(3);
export const lightCyclesQuadShared = definition(4);
