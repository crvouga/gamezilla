import { lightCyclesModeConfig } from '@libs/light-cycles-shared-ts/light-cycles-position';
import { lightCyclesStarts } from '@libs/light-cycles-shared-ts/light-cycles-spawns';
import {
  type LightCyclesState,
  lightCyclesRider,
  trailMark,
} from '@libs/light-cycles-shared-ts/light-cycles-state';
import {
  MODEL_RIDERS,
  type ModelArena,
  type ModelRider,
} from './light-cycles-model-arena';

type Cell = readonly [number, number];
const RIDERS = Object.keys(MODEL_RIDERS) as ModelRider[];

const STAGES = {
  countdown: 'counting down',
  running: 'riding',
  'round-over': 'result',
  completed: 'result',
} as const;

function riderOfSeat(seat: string): ModelRider {
  const rider = RIDERS.find((name) => MODEL_RIDERS[name].seat === seat);
  if (rider === undefined) throw new Error(`no rider rides ${seat}`);
  return rider;
}

/** Arena cells count from column 1, row 1 at the top left. */
const cell = (x: number, y: number): Cell => [x + 1, y + 1];

function trailOf(state: LightCyclesState, rider: ModelRider): Set<Cell> {
  const mark = trailMark(MODEL_RIDERS[rider].seat);
  const cells = new Set<Cell>();
  for (let index = 0; index < state.trails.length; index++)
    if (state.trails[index] === mark)
      cells.add(cell(index % state.width, Math.floor(index / state.width)));
  return cells;
}

/**
 * Where the model puts a rider that is not in this game (Nova in a Duel):
 * the starting cell its seat would take this round, by the product's own
 * rotation. Nothing in the product rides it; the model only needs a value.
 */
function absentRider(
  arena: ModelArena,
  rider: ModelRider
): { readonly cell: Cell; readonly heading: string } {
  const state = arena.arena;
  const seat = Object.keys(MODEL_RIDERS).indexOf(rider);
  const starts = lightCyclesStarts(lightCyclesModeConfig(arena.mode));
  const start = starts[(seat + state.round - 1) % state.seats.length]!;
  return { cell: cell(start.x, start.y), heading: start.heading };
}

function riderView(arena: ModelArena, rider: ModelRider) {
  const state = arena.arena;
  const seated = lightCyclesRider(state, MODEL_RIDERS[rider].seat);
  if (seated === null) {
    const absent = absentRider(arena, rider);
    return { ...absent, nextStep: '', trail: new Set<Cell>(), riding: false };
  }
  return {
    cell: cell(seated.x, seated.y),
    heading: seated.heading,
    nextStep: seated.alive ? (seated.turns[0] ?? seated.heading) : '',
    trail: trailOf(state, rider),
    riding: seated.alive,
  };
}

/** The game's names for what the watcher's device shows of the arena. */
export function readModelArena(arena: ModelArena) {
  const state = arena.arena;
  const views = new Map(
    RIDERS.map((rider) => [rider, riderView(arena, rider)])
  );
  const of = <T>(pick: (view: ReturnType<typeof riderView>) => T) =>
    new Map(RIDERS.map((rider) => [rider, pick(views.get(rider)!)]));
  const riders = state.seats.map(riderOfSeat);
  const ended = state.phase === 'round-over' || state.phase === 'completed';
  const winner = state.roundWinner;
  const result = state.result;
  return {
    mode: arena.game,
    riders: new Set(riders),
    riderCell: of((view) => view.cell),
    heading: of((view) => view.heading),
    nextStep: of((view) => view.nextStep),
    trail: of((view) => view.trail),
    riding: new Set(riders.filter((rider) => views.get(rider)!.riding)),
    crashed: new Set(riders.filter((rider) => !views.get(rider)!.riding)),
    roundNumber: state.round,
    roundStage: STAGES[state.phase],
    // The arena keeps the last round's winner; the model names this round's.
    roundWinner:
      !ended || winner === null
        ? ''
        : winner === 'draw'
          ? 'nobody'
          : riderOfSeat(winner),
    roundWins: new Map(
      RIDERS.map((rider) => {
        const index = state.seats.indexOf(MODEL_RIDERS[rider].seat);
        return [rider, index < 0 ? 0 : state.scores[index]!];
      })
    ),
    targetScore: state.targetScore,
    gameStage: state.phase === 'completed' ? 'finished' : 'under way',
    gameWinner:
      result === null
        ? ''
        : result.winner === 'draw'
          ? 'draw'
          : riderOfSeat(result.winner),
  };
}

/** Problems the binding saw outside the model's variables, such as a turn that was not refused. */
export const readModelProblems = (arena: ModelArena) => [...arena.problems];
