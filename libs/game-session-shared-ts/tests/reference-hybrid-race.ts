import { defineGame } from '@libs/game-session-shared-ts/game-definition';
import type { GameRules } from '@pkgs/turn-game-shared-ts/game-rules';
import { defineSimulation } from '@pkgs/turn-game-shared-ts/game-simulation';
import { z } from 'zod';
import { rules } from './reference-game';
import {
  type RaceState,
  raceStep,
  simulationOptions,
} from './reference-simulation';

/** The framework's counting race, with discrete token advances and live elapsed distance. */
const schema = z
  .object({
    distance: z.number(),
    luck: z.number(),
    inputs: z.array(z.string()),
    tokens: z.number().int().min(0).max(4),
  })
  .strict();
type TimedRace = RaceState & { readonly tokens: number };
const initial = (): TimedRace => ({
  distance: 0,
  luck: 0,
  inputs: [],
  tokens: 0,
});
export const timedRaceCodec = {
  encode: (state: TimedRace) => `race-timed:${JSON.stringify(state)}`,
  decode: (position: string): TimedRace | null => {
    if (!position.startsWith('race-timed:')) return null;
    try {
      return schema.parse(JSON.parse(position.slice(11)));
    } catch {
      return null;
    }
  },
};
const turns: GameRules = {
  ...rules,
  initial: () => timedRaceCodec.encode(initial()),
  recognizes: (position) => timedRaceCodec.decode(position) !== null,
  play: (position, action) => {
    const state = timedRaceCodec.decode(position)!;
    if (action !== 'advance-token' || state.tokens >= 4) return null;
    const tokens = state.tokens + 1;
    return {
      position: timedRaceCodec.encode({ ...state, tokens }),
      history: String(tokens),
      turn: tokens % 2 === 0 ? 'white' : 'black',
      label: `step ${tokens}`,
      winner: tokens === 4 ? 'black' : null,
      reason: tokens === 4 ? 'finish line' : null,
    };
  },
  replay: (_actions, ply) =>
    timedRaceCodec.encode({ ...initial(), tokens: ply }),
  legal: (position) =>
    timedRaceCodec.decode(position)!.tokens === 4 ? [] : ['advance-token'],
};
export const hybridRaceGame = defineGame({
  rules: turns,
  turnAutomation: { choose: () => 'advance-token', perform: async () => {} },
  capabilities: {
    'custom-games': { bots: { difficulties: [] } },
    history: { record: (position) => position },
    matchmaking: {
      namespace: 'counting-race/',
      notice: { side: (side) => side, ending: () => undefined },
    },
  },
  simulation: defineSimulation<TimedRace, number>(
    {
      initialize: initial,
      step: (state, inputs, context) => ({
        ...state,
        ...raceStep(state, inputs, context),
      }),
      parseInput: (value) =>
        typeof value === 'number' && Number.isSafeInteger(value) ? value : null,
      result: () => null,
    },
    timedRaceCodec,
    { ...simulationOptions, snapshotRate: 20 },
    {
      bots: {
        input: (_state, _side, _difficulty, context) =>
          Math.floor(context.random() * 10),
      },
      commands: {
        key: (state: TimedRace) => String(state.tokens),
        rebase: (current: TimedRace, changed: TimedRace) => ({
          ...current,
          tokens: changed.tokens,
        }),
      },
    }
  ),
});
