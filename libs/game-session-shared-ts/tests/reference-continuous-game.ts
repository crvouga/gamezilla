import { defineGame } from '@libs/game-session-shared-ts/game-definition';
import { defineSimulation } from '@pkgs/turn-game-shared-ts/game-simulation';
import { z } from 'zod';
import { rules } from './reference-game';
import {
  type RaceState,
  raceStep,
  simulationOptions,
} from './reference-simulation';

/** Continuous motion of the same counting-race example, without a fabricated turn API. */
const schema = z
  .object({
    distance: z.number(),
    luck: z.number(),
    inputs: z.array(z.string()),
  })
  .strict();
const codec = {
  encode: (state: RaceState) => `race-live:${JSON.stringify(state)}`,
  decode: (position: string): RaceState | null => {
    if (!position.startsWith('race-live:')) return null;
    try {
      return schema.parse(JSON.parse(position.slice(10)));
    } catch {
      return null;
    }
  },
};
const initial = (): RaceState => ({ distance: 0, luck: 0, inputs: [] });
const simulation = defineSimulation(
  {
    initialize: initial,
    parseInput: (value) =>
      typeof value === 'number' &&
      Number.isSafeInteger(value) &&
      value >= 0 &&
      value < 100
        ? value
        : null,
    step: (state, inputs, context) =>
      state.distance >= 1000 ? state : raceStep(state, inputs, context),
    result: (state) =>
      state.distance >= 1000
        ? { winner: 'white', reason: 'finish line' }
        : null,
    checkpointKey: (state) => String(Math.floor(state.distance / 250)),
  },
  codec,
  { ...simulationOptions, snapshotRate: 20 },
  {
    bots: {
      input: (_state, _player, _difficulty, context) =>
        Math.floor(context.random() * 10),
    },
  }
);

export const continuousRaceGame = defineGame({
  rules: {
    id: rules.id,
    initial: () => codec.encode(initial()),
    recognizes: (position) => codec.decode(position) !== null,
  },
  simulation,
  capabilities: {
    'custom-games': {
      bots: { difficulties: ['easy', 'medium', 'hard'] },
      localPlayers: true,
    },
    history: { record: (position) => position },
    matchmaking: {
      namespace: 'counting-race/',
      notice: {
        side: (side) => side,
        ending: () => undefined,
      },
    },
  },
});
