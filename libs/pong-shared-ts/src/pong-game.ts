import { defineGame } from '@libs/game-session-shared-ts/game-definition';
import type {
  GamePositionRules,
  GameSide,
} from '@pkgs/turn-game-shared-ts/game-rules';
import { defineSimulation } from '@pkgs/turn-game-shared-ts/game-simulation';
import { pongAutomation } from './pong-automation';
import { pongBot } from './pong-bot';
import { pongCodec } from './pong-codec';
import { pongConfig } from './pong-config';
import {
  createPongPrediction,
  createPongPredictionError,
  interpolatePong,
} from './pong-presentation';
import {
  initialPongState,
  PONG_NEUTRAL_INPUT,
  parsePongInput,
} from './pong-state';
import { createPongStep } from './pong-step';

const config = pongConfig();
const serialized = pongCodec(config);
export const pongPositionCodec = {
  encode: (state: Parameters<typeof serialized.encode>[0]) =>
    `pong:${serialized.encode(state)}`,
  decode: (position: string) =>
    position.startsWith('pong:') ? serialized.decode(position.slice(5)) : null,
};
const requirePosition = (position: string) => {
  const state = pongPositionCodec.decode(position);
  if (state === null) throw new Error('invalid Pong position');
  return state;
};
const initial = () =>
  pongPositionCodec.encode(initialPongState(config, () => 0));
const step = createPongStep(config);
const sideLabel = (side: GameSide) => (side === 'white' ? 'Left' : 'Right');

const positions: GamePositionRules = {
  id: 'pong',
  initial,
  recognizes: (position) => pongPositionCodec.decode(position) !== null,
  configuration: {
    apply: (position, choice) => {
      const targetScore = Number(choice);
      if (!/^[1-9][0-9]?$/.test(choice)) return null;
      const state = requirePosition(position);
      return pongPositionCodec.encode({ ...state, targetScore });
    },
    restart: (position) =>
      pongPositionCodec.encode(
        initialPongState(
          pongConfig({ targetScore: requirePosition(position).targetScore }),
          () => 0
        )
      ),
  },
};

const simulation = defineSimulation(
  {
    initialize: (random) => initialPongState(config, random),
    step: (state, inputs, context) =>
      step(
        state,
        inputs.map((input) => ({
          ...input,
          playerId:
            input.playerId === 'white'
              ? 'left'
              : input.playerId === 'black'
                ? 'right'
                : input.playerId,
        })),
        context
      ),
    parseInput: parsePongInput,
    result: (state) =>
      state.winner === null
        ? null
        : {
            winner: state.winner === 'left' ? 'white' : 'black',
            reason: 'score target',
          },
    phase: (state) => (state.phase === 'playing' ? 'running' : state.phase),
    checkpointKey: (state) => String(state.feedback.points),
    resetInputs: (state) => ({
      ...state,
      paddles: {
        left: { ...state.paddles.left, input: PONG_NEUTRAL_INPUT },
        right: { ...state.paddles.right, input: PONG_NEUTRAL_INPUT },
      },
    }),
  },
  pongPositionCodec,
  {
    tickRate: config.tickRate,
    snapshotRate: config.snapshotRate,
    maxCatchUpTicks: config.maxCatchUpTicks,
    maxQueuedInputs: config.maxQueuedInputs,
    maxInputLeadTicks: config.maxInputLeadTicks,
  },
  {
    bots: {
      input: (state, side, difficulty, context) =>
        pongBot(
          config,
          side === 'white' ? 'left' : 'right',
          difficulty
        )(state, context),
    },
    presentation: {
      interpolate: interpolatePong,
      predict: createPongPrediction(config),
      predictionError: createPongPredictionError(config),
      mergeLocal: (state, predicted, side) => {
        const paddle = side === 'white' ? 'left' : 'right';
        return {
          ...state,
          paddles: { ...state.paddles, [paddle]: predicted.paddles[paddle] },
        };
      },
    },
  }
);

/** Pong supplies mechanics, copy and record data; the framework owns every session and transport. */
export const pongGameShared = defineGame({
  rules: positions,
  simulation,
  continuousAutomation: pongAutomation(simulation),
  capabilities: {
    'custom-games': {
      bots: { difficulties: ['easy', 'medium', 'hard'] },
      localPlayers: true,
    },
    matchmaking: {
      namespace: 'pong/',
      notice: {
        side: sideLabel,
        ending: (reason) =>
          reason === 'score target'
            ? 'The score target was reached.'
            : undefined,
      },
    },
    history: {
      record: (position, _history, metadata) =>
        JSON.stringify({
          game: 'pong',
          participants: metadata.participants,
          outcome: metadata.outcome,
          reason: metadata.reason,
          score: requirePosition(position).score,
          targetScore: requirePosition(position).targetScore,
        }),
    },
  },
});
