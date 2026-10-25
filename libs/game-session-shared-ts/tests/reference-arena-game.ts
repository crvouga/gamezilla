import { defineGame } from '@libs/game-session-shared-ts/game-definition';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import { defineSimulation } from '@pkgs/turn-game-shared-ts/game-simulation';
import { z } from 'zod';
import { simulationOptions } from './reference-simulation';

/**
 * A three-seat arena exercising discrete commands, round fences and the
 * continuing disconnection policy: every 30 ticks starts a new round, and a
 * command records the tick the authority applied it at.
 */
export type ArenaState = {
  readonly round: number;
  readonly ticks: number;
  readonly log: readonly string[];
  readonly retired: readonly GameSide[];
};
export type ArenaCommand = { readonly round: number; readonly turn: string };

export const ARENA_ROUND_TICKS = 30;
export const ARENA_GRACE_MS = 100;
const sides = ['white', 'black', 'red'] as const;
const schema = z
  .object({
    round: z.number().int().min(1),
    ticks: z.number().int().min(0),
    log: z.array(z.string()),
    retired: z.array(z.enum(sides)),
  })
  .strict();
export const arenaCodec = {
  encode: (state: ArenaState) => `arena:${JSON.stringify(state)}`,
  decode: (position: string): ArenaState | null => {
    if (!position.startsWith('arena:')) return null;
    try {
      return schema.parse(JSON.parse(position.slice(6)));
    } catch {
      return null;
    }
  },
};
const parseCommand = (value: unknown): ArenaCommand | null => {
  const parsed = z
    .object({
      round: z.number().int().min(1),
      turn: z.enum(['left', 'right']),
    })
    .strict()
    .safeParse(value);
  return parsed.success ? parsed.data : null;
};
const initial = (): ArenaState => ({
  round: 1,
  ticks: 0,
  log: [],
  retired: [],
});

export const arenaSimulation = defineSimulation<ArenaState, ArenaCommand>(
  {
    initialize: initial,
    parseInput: parseCommand,
    step: (state, inputs, context) => {
      if (state.ticks >= 600) return state;
      const ticks = state.ticks + 1;
      return {
        round: Math.floor(ticks / ARENA_ROUND_TICKS) + 1,
        ticks,
        retired: state.retired,
        log: [
          ...state.log,
          ...inputs
            .filter((input) => input.value.round === state.round)
            .map(
              (input) =>
                `${context.tick}:${input.playerId}:${input.sequence}:${input.value.turn}`
            ),
        ],
      };
    },
    result: (state) =>
      state.ticks >= 600 ? { winner: 'white', reason: 'last rider' } : null,
    checkpointKey: (state) => String(state.round),
  },
  arenaCodec,
  { ...simulationOptions, snapshotRate: 20 },
  {
    bots: { input: (state) => ({ round: state.round, turn: 'left' }) },
    input: { mode: 'commands', maxPendingPerPlayer: 2, maxAgeTicks: 10 },
    rounds: {
      current: (state) => state.round,
      ofInput: (command) => command.round,
    },
    disconnection: {
      policy: 'continue',
      graceMs: ARENA_GRACE_MS,
      retire: (state, side) =>
        state.retired.includes(side)
          ? state
          : {
              ...state,
              retired: [...state.retired, side],
              log: [...state.log, `${state.ticks + 1}:retire:${side}`],
            },
    },
  }
);

export const arenaGame = defineGame({
  rules: {
    id: 'arena-race',
    sides,
    initial: () => arenaCodec.encode(initial()),
    recognizes: (position) => arenaCodec.decode(position) !== null,
  },
  simulation: arenaSimulation,
  capabilities: {
    'custom-games': { bots: { difficulties: [] } },
    history: { record: (position) => position },
    matchmaking: {
      namespace: 'arena-race/',
      notice: { side: (side) => side, ending: () => undefined },
    },
  },
});
