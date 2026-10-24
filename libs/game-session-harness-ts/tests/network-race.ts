import { defineGame } from '@libs/game-session-shared-ts/game-definition';
import { defineSimulation } from '@pkgs/turn-game-shared-ts/game-simulation';

export type RaceState = {
  readonly distance: number;
  readonly luck: number;
  readonly inputs: readonly string[];
};
const initial = (): RaceState => ({ distance: 0, luck: 0, inputs: [] });
const encode = (state: RaceState) => `race-live:${JSON.stringify(state)}`;
export function decode(position: string): RaceState | null {
  if (!position.startsWith('race-live:')) return null;
  try {
    const value = JSON.parse(position.slice(10)) as RaceState;
    return Number.isFinite(value.distance) &&
      Number.isFinite(value.luck) &&
      Array.isArray(value.inputs) &&
      value.inputs.every((input) => typeof input === 'string')
      ? value
      : null;
  } catch {
    return null;
  }
}

/** The same counting-race example, with enough track for a bounded network campaign. */
export const networkRace = defineGame({
  rules: {
    id: 'counting-race',
    initial: () => encode(initial()),
    recognizes: (position) => decode(position) !== null,
  },
  simulation: defineSimulation<RaceState, number>(
    {
      initialize: initial,
      parseInput: (value) =>
        typeof value === 'number' &&
        Number.isSafeInteger(value) &&
        value >= 0 &&
        value < 100
          ? value
          : null,
      step: (state, inputs, context) => ({
        distance: state.distance + context.deltaMs,
        luck: state.luck + context.random(),
        inputs: [
          ...state.inputs,
          ...inputs.map(
            (input) =>
              `${context.tick}:${input.playerId}:${input.sequence}:${input.value}`
          ),
        ],
      }),
      result: (state) =>
        state.distance >= 10_000
          ? { winner: 'white', reason: 'finish line' }
          : null,
    },
    { encode, decode },
    {
      tickRate: 60,
      snapshotRate: 20,
      maxCatchUpTicks: 8,
      maxQueuedInputs: 64,
      maxInputLeadTicks: 30,
    },
    {
      bots: {
        input: (_state, _side, _difficulty, context) =>
          Math.floor(context.random() * 10),
      },
    }
  ),
  capabilities: {
    'custom-games': { bots: { difficulties: ['easy', 'medium', 'hard'] } },
  },
});
