/**
 * The reference game: test-only, never shipped. A race to seven where each
 * turn counts one on (`advance`) or, from five or less, two (`leap`); who
 * reaches seven wins. It is registered, rendered and played purely through
 * the platform's public contracts — `defineTurnGame`, `defineGameClient`
 * and a `HarnessGame` — and enrolled in every shared suite beside the
 * registered games (`tests/conformance-world.ts`). It proves a new game
 * needs no change to any shared screen, workflow, specification or suite;
 * it offers custom games, history and puzzles but not matchmaking, so the
 * matrix holds an unsupported capability too.
 *
 * A position is `race:<count><side to move>` (`race:3w`): the count alone
 * cannot say whose turn it is once a turn may count two.
 */

import type { GameClient } from '@libs/game-menu-client/game-client';
import { defineGameClient } from '@libs/game-menu-client/game-client';
import type { PuzzleBoardProps } from '@libs/game-puzzle-client/puzzle-client';
import type {
  GameFixtures,
  HarnessGame,
} from '@libs/game-session-harness/harness-game';
import { assertHarnessGame } from '@libs/game-session-harness/harness-game';
import type { TurnGame } from '@libs/game-session-shared/turn-game-definition';
import { defineTurnGame } from '@libs/game-session-shared/turn-game-definition';
import type { GameBoardProps } from '@pkgs/turn-game-shared/game-presentation';
import type {
  PuzzleRecord,
  PuzzleRecordVerdict,
  PuzzlesCapability,
} from '@pkgs/turn-game-shared/game-puzzles';
import type {
  GameRules,
  GameSide,
  PlayedPosition,
  TurnGameCapabilities,
} from '@pkgs/turn-game-shared/game-rules';
import { For, type JSX } from 'solid-js';

/**
 * Seven, the length of the victory every custom-game model follows
 * (`tests/quint/model-game.ts`): seven advances, the first side counting the
 * last number.
 */
const FINISH = 7;
/** A leap counts two, so it is allowed only where it cannot pass seven. */
const LEAP_UP_TO = FINISH - 2;
const STEP = { advance: 1, leap: 2 } as const;
type RaceAction = keyof typeof STEP;

const POSITION = /^race:([0-7])([wb])$/;

type Race = { readonly count: number; readonly mover: GameSide };

function parse(position: string): Race | null {
  const match = POSITION.exec(position);
  if (match === null) return null;
  return {
    count: Number(match[1]),
    mover: match[2] === 'w' ? 'white' : 'black',
  };
}

const show = (race: Race) =>
  `race:${race.count}${race.mover === 'white' ? 'w' : 'b'}`;
const other = (side: GameSide): GameSide =>
  side === 'white' ? 'black' : 'white';

function legal(position: string): readonly RaceAction[] {
  const race = parse(position);
  if (race === null || race.count >= FINISH) return [];
  return race.count <= LEAP_UP_TO ? ['advance', 'leap'] : ['advance'];
}

const labelOf = (action: RaceAction, count: number) =>
  action === 'advance' ? `step ${count}` : `leap to ${count}`;

function play(
  position: string,
  action: string,
  history: string
): PlayedPosition | null {
  const race = parse(position);
  const move = legal(position).find((candidate) => candidate === action);
  if (race === null || move === undefined) return null;
  const count = race.count + STEP[move];
  return {
    position: show({ count, mover: other(race.mover) }),
    history: `${history}${history === '' ? '' : ' '}${count}`,
    turn: other(race.mover),
    label: labelOf(move, count),
    winner: count === FINISH ? race.mover : null,
    reason: count === FINISH ? 'finish line' : null,
  };
}

/**
 * Every action from the start, as played; an action its rules refuse is
 * never replayed into a position.
 */
function playedFromStart(
  actions: readonly string[]
): readonly PlayedPosition[] {
  const played: PlayedPosition[] = [];
  let position = 'race:0w';
  let history = '';
  for (const action of actions) {
    const next = play(position, action, history);
    if (next === null)
      throw new Error(`counting-race: ${action} is refused at ${position}`);
    played.push(next);
    position = next.position;
    history = next.history;
  }
  return played;
}

export const COUNTING_RACE_RULES: GameRules = {
  id: 'counting-race',
  recognizes: (position) => parse(position) !== null,
  initial: () => 'race:0w',
  play: (position, action, history) => play(position, action, history),
  replay: (actions, ply) =>
    playedFromStart(actions.slice(0, ply)).at(-1)?.position ?? 'race:0w',
  legal,
  canWin: () => true,
  // The history is the counts reached, so it alone says every move: a
  // count one on is an advance, two on a leap, each side in turn.
  moves: (_position, history) => {
    const counts = history === '' ? [] : history.split(' ').map(Number);
    return counts.map((count, ply) => {
      const from = ply === 0 ? 0 : (counts[ply - 1] ?? 0);
      const mover: GameSide = ply % 2 === 0 ? 'white' : 'black';
      return {
        label: labelOf(count - from === 2 ? 'leap' : 'advance', count),
        before: show({ count: from, mover }),
        after: show({ count, mover: other(mover) }),
      };
    });
  },
};

const advance = (position: string) =>
  legal(position).includes('advance') ? 'advance' : null;

/** The board's cells: the counts. */
const CELLS = ['0', '1', '2', '3', '4', '5', '6', '7'] as const;

/**
 * A stored race puzzle: its id in `counting-race/`, a race position not yet
 * finished, and a line its rules play in turn that only its last move wins,
 * for the side the setup move gives the turn.
 */
function validateRacePuzzle(record: PuzzleRecord): PuzzleRecordVerdict {
  const refuse = (reason: string, detail: string) =>
    ({ ok: false, reason, detail }) as const;
  if (!/^counting-race\/[a-z0-9-]+$/.test(record.id))
    return refuse('id', `${record.id} is not a counting race puzzle id`);
  const start = parse(record.position);
  if (start === null || start.count >= FINISH)
    return refuse('position', `${record.position} is not a race under way`);
  if (record.line.length < 2 || record.line.length % 2 !== 0)
    return refuse('line', 'the line must end with a solver move');
  let position = record.position;
  for (const [index, action] of record.line.entries()) {
    const played = play(position, action, '');
    if (played === null) return refuse('line', `${action} is refused`);
    const last = index === record.line.length - 1;
    const solved = played.winner === other(start.mover);
    if (played.winner !== null && !(last && solved))
      return refuse('line', `${action} ends the race early or for the setter`);
    if (last && !solved) return refuse('unsolved', 'the line never wins');
    position = played.position;
  }
  return { ok: true };
}

export const COUNTING_RACE_PUZZLES: PuzzlesCapability = {
  namespace: 'counting-race/',
  content: { validate: validateRacePuzzle },
  marks(position, action) {
    const race = parse(position);
    const move = legal(position).find((candidate) => candidate === action);
    if (race === null || move === undefined) return null;
    return { from: String(race.count), to: String(race.count + STEP[move]) };
  },
  isCell: (cell) => (CELLS as readonly string[]).includes(cell),
};

/** The race's two buttons, each prefixed with the board's test id. */
function RaceButtons(props: {
  readonly testId: string;
  readonly position: string;
  readonly interactive: boolean;
  readonly onAction: (action: string) => void;
}): JSX.Element {
  return (
    <For each={['advance', 'leap'] as const}>
      {(action) => (
        <button
          type="button"
          data-testid={`${props.testId}-${action}`}
          disabled={
            !props.interactive || !legal(props.position).includes(action)
          }
          onClick={() => props.onAction(action)}
        >
          {action === 'advance' ? 'Count one' : 'Count two'} from{' '}
          {parse(props.position)?.count}
        </button>
      )}
    </For>
  );
}

function Board(props: GameBoardProps): JSX.Element {
  return (
    <div data-testid={props.testId} data-position={props.position}>
      <RaceButtons
        testId={props.testId}
        position={props.position}
        interactive={props.interactive}
        onAction={props.onAction}
      />
    </div>
  );
}

/** How a puzzle board marks a count: wrong, hinted, the solution's ends. */
function markOf(marks: PuzzleBoardProps['marks'], cell: string): string {
  if (marks.wrong === cell) return 'wrong';
  if (marks.hint === cell) return 'hint';
  if (marks.solution?.to === cell || marks.solution?.from === cell)
    return 'solution';
  return '';
}

/** The puzzle board: the counts, each with its mark, and the race's buttons. */
function PuzzleBoard(props: PuzzleBoardProps): JSX.Element {
  return (
    <div data-testid={props.testId} data-position={props.position}>
      <ol>
        <For each={CELLS}>
          {(cell) => (
            <li data-cell={cell} data-mark={markOf(props.marks, cell)}>
              {cell}
            </li>
          )}
        </For>
      </ol>
      <RaceButtons
        testId={props.testId}
        position={props.position}
        interactive={props.interactive && props.mode === 'play'}
        onAction={props.onAction}
      />
    </div>
  );
}

const sideLabel = (side: 'white' | 'black') =>
  side === 'white' ? 'Hare' : 'Tortoise';

const CAPABILITIES = {
  'custom-games': { bots: { difficulties: ['easy'], choose: advance } },
  history: { record: (position: string) => position },
  puzzles: COUNTING_RACE_PUZZLES,
} satisfies TurnGameCapabilities;

/**
 * What the reference game hands `defineTurnGame` and `defineGameClient`:
 * a faulty copy (`faulty-games.test.ts`) changes one part and is defined
 * through the same constructors, as any game would be.
 */
export const COUNTING_RACE_TURN_GAME: TurnGame<typeof CAPABILITIES> = {
  rules: COUNTING_RACE_RULES,
  capabilities: CAPABILITIES,
  automation: {
    choose: advance,
    async perform(ui, board, action) {
      await ui.get(`${board}-${action}`).tap();
    },
  },
};

export const COUNTING_RACE_SHARED = defineTurnGame(COUNTING_RACE_TURN_GAME);

export const COUNTING_RACE_CLIENT: GameClient<typeof CAPABILITIES> = {
  shared: COUNTING_RACE_SHARED,
  title: 'Counting race',
  caption: 'Count to seven first',
  subtitle: () => 'Take turns counting on.',
  presentation: {
    canFlip: false,
    name: () => 'Counting race',
    Board,
    sideLabel,
    endingDescription: (reason) =>
      reason === 'finish line' ? 'First to seven.' : undefined,
    timeoutDrawDescription: () => 'Drawn on time.',
    endingLabel: () => 'finish line',
  },
  puzzles: { Board: PuzzleBoard },
};

/** A race puzzle record, as a seed would store it. */
function racePuzzle(
  id: string,
  position: string,
  line: readonly string[]
): PuzzleRecord {
  return {
    id: `counting-race/${id}`,
    position,
    line,
    rating: 1200,
    ratingDeviation: 80,
    popularity: 90,
    plays: 10,
    themes: ['short'],
  };
}

export const COUNTING_RACE_FIXTURES: GameFixtures<typeof CAPABILITIES> = {
  firstSideVictory: [
    'advance',
    'advance',
    'advance',
    'advance',
    'advance',
    'advance',
    'advance',
  ],
  // Each count is written as the step it reaches.
  firstSideVictoryLabels: [1, 2, 3, 4, 5, 6, 7].map((step) => `step ${step}`),
  refusedOpenings: ['retreat', ''],
  // Whoever is to move at four loses: both counts on (to five or six) let
  // the other reach seven. So the winning move leaves the other side at
  // four, and at five or six the side to move reaches seven.
  puzzles: [
    {
      // The Tortoise counts to five; the Hare leaps home. Counting one
      // leaves six, from which the Tortoise reaches seven.
      record: racePuzzle('leap-home', 'race:4b', ['advance', 'leap']),
      solverSide: 'white',
      solution: ['leap'],
      labels: ['step 5', 'leap to 7'],
      wrongMove: { at: 1, action: 'advance' },
      refusedMove: { at: 1, action: 'retreat' },
    },
    {
      // The Hare leaps to three; the Tortoise counts to four and, after the
      // Hare's leap to six, steps home. Leaping to five instead lets the
      // Hare leap home; from six a leap would pass seven.
      record: racePuzzle('hold-four', 'race:1w', [
        'leap',
        'advance',
        'leap',
        'advance',
      ]),
      solverSide: 'black',
      solution: ['advance', 'advance'],
      labels: ['leap to 3', 'step 4', 'leap to 6', 'step 7'],
      wrongMove: { at: 1, action: 'leap' },
      refusedMove: { at: 3, action: 'leap' },
    },
    {
      // From three the Hare counts one, the Tortoise one, and the Hare
      // leaps home; leaping first and stepping home after the Tortoise's
      // count reaches the same finish (seven, the Tortoise to move). At
      // five, counting one instead of leaping hands the Tortoise six.
      record: racePuzzle('either-order', 'race:2b', [
        'advance',
        'advance',
        'advance',
        'leap',
      ]),
      solverSide: 'white',
      solution: ['advance', 'leap'],
      labels: ['step 3', 'step 4', 'step 5', 'leap to 7'],
      wrongMove: { at: 3, action: 'advance' },
      refusedMove: { at: 1, action: 'retreat' },
      transposition: { at: 1, action: 'leap' },
    },
  ],
};

export const COUNTING_RACE_GAME: HarnessGame = assertHarnessGame({
  label: 'counting race',
  shared: COUNTING_RACE_SHARED,
  client: defineGameClient(COUNTING_RACE_CLIENT),
  fixtures: COUNTING_RACE_FIXTURES,
});
