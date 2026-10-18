/**
 * The reference game: test-only, never shipped. A race to seven where each
 * turn counts one on (`advance`), from five or less two (`leap`), or from
 * four or less three (`hop`); who reaches seven wins. It is registered, rendered and played purely through
 * the platform's public contracts — `defineTurnGame`, `defineGameClient`
 * and a `HarnessGame` — and enrolled in every shared suite beside the
 * registered games (`tests/conformance-world.ts`). It proves a new game
 * needs no change to any shared screen, workflow, specification or suite;
 * it offers custom games, history and puzzles but not matchmaking, so the
 * matrix holds an unsupported capability too.
 *
 * A position is `race:<count><side to move>` (`race:3w`): the count alone
 * cannot say whose turn it is once a turn may count more than one.
 */

import type { GameClient } from '@libs/game-menu-client/game-client';
import { defineGameClient } from '@libs/game-menu-client/game-client';
import { PersonalPuzzleStatsScreen } from '@libs/game-puzzle-client/personal-puzzle-stats-screen';
import type { PuzzleBoardProps } from '@libs/game-puzzle-client/puzzle-client';
import type {
  GameFixtures,
  HarnessGame,
} from '@libs/game-session-harness/harness-game';
import { assertHarnessGame } from '@libs/game-session-harness/harness-game';
import type { TurnGame } from '@libs/game-session-shared/turn-game-definition';
import { defineTurnGame } from '@libs/game-session-shared/turn-game-definition';
import { Handles } from '@libs/test-ids-shared/handles';
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
import { useRouter } from '@pkgs/ui-root-client/app-router';
import { MenuRow } from '@pkgs/ui-root-client/menu-row';
import { MenuSection } from '@pkgs/ui-root-client/menu-section';
import { For, type JSX } from 'solid-js';

/**
 * Seven, the length of the victory every custom-game model follows
 * (`tests/quint/model-game.ts`): seven advances, the first side counting the
 * last number.
 */
const FINISH = 7;
/** A count is allowed only where it cannot pass seven. */
const STEP = { advance: 1, leap: 2, hop: 3 } as const;
type RaceAction = keyof typeof STEP;
const ACTIONS = Object.keys(STEP) as readonly RaceAction[];

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
  return ACTIONS.filter((action) => race.count + STEP[action] <= FINISH);
}

const LABEL_VERB = { advance: 'step', leap: 'leap to', hop: 'hop to' };
const labelOf = (action: RaceAction, count: number) =>
  `${LABEL_VERB[action]} ${count}`;

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
  // count one on is an advance, two on a leap, three a hop, each side in
  // turn.
  moves: (_position, history) => {
    const counts = history === '' ? [] : history.split(' ').map(Number);
    return counts.map((count, ply) => {
      const from = ply === 0 ? 0 : (counts[ply - 1] ?? 0);
      const mover: GameSide = ply % 2 === 0 ? 'white' : 'black';
      const action =
        ACTIONS.find((candidate) => STEP[candidate] === count - from) ??
        'advance';
      return {
        label: labelOf(action, count),
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

/** How a button names each count. */
const COUNT_WORDS = { advance: 'one', leap: 'two', hop: 'three' } as const;

/**
 * The race's buttons, one per count, each prefixed with the board's test
 * id. A board that `refuses` nothing itself leaves every count to the
 * rules: one they do not allow (three from five) reaches the platform,
 * which refuses it.
 */
function RaceButtons(props: {
  readonly testId: string;
  readonly position: string;
  readonly interactive: boolean;
  readonly refuses: boolean;
  readonly onAction: (action: string) => void;
}): JSX.Element {
  return (
    <For each={ACTIONS}>
      {(action) => (
        <button
          type="button"
          data-testid={`${props.testId}-${action}`}
          disabled={
            !props.interactive ||
            (props.refuses && !legal(props.position).includes(action))
          }
          onClick={() => props.onAction(action)}
        >
          Count {COUNT_WORDS[action]} from {parse(props.position)?.count}
        </button>
      )}
    </For>
  );
}

/**
 * The waiting side's buttons on a puzzle board: a count for the side not
 * to move, `<side>-advance` or `<side>-leap`, which the rules never allow.
 */
function WaitingSideButtons(props: {
  readonly testId: string;
  readonly position: string;
  readonly interactive: boolean;
  readonly onAction: (action: string) => void;
}): JSX.Element {
  const waiting = () => {
    const race = parse(props.position);
    return race === null ? null : sideName(other(race.mover));
  };
  return (
    <For each={['advance', 'leap'] as const}>
      {(action) => (
        <button
          type="button"
          data-testid={`${props.testId}-${waiting() ?? ''}-${action}`}
          disabled={!props.interactive || waiting() === null}
          onClick={() => props.onAction(`${waiting() ?? ''}-${action}`)}
        >
          {waiting()} counts {COUNT_WORDS[action]}
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
        refuses
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

/**
 * The puzzle board: the counts, each with its mark, the race's buttons for
 * the side to move and the waiting side's. Every count reaches the
 * platform, which judges it by the rules.
 */
function PuzzleBoard(props: PuzzleBoardProps): JSX.Element {
  const interactive = () => props.interactive && props.mode === 'play';
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
        interactive={interactive()}
        refuses={false}
        onAction={props.onAction}
      />
      <WaitingSideButtons
        testId={props.testId}
        position={props.position}
        interactive={interactive()}
        onAction={props.onAction}
      />
    </div>
  );
}

const sideLabel = (side: 'white' | 'black') =>
  side === 'white' ? 'Hare' : 'Tortoise';
/** A side as a count named for it writes it: `hare`, `tortoise`. */
const sideName = (side: GameSide) => sideLabel(side).toLowerCase();

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

/** The themes a race's feed can be limited to. */
const RACE_THEMES = ['short', 'long'] as const satisfies readonly string[];

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
  puzzles: {
    Board: PuzzleBoard,
    // A long race is a theme no known puzzle has: a feed limited to it is
    // empty.
    themes: {
      choices: RACE_THEMES,
      label: (theme) => (theme === 'long' ? 'Long race' : 'Short race'),
    },
  },
};

/**
 * A race puzzle record, as a seed would store it. Every known puzzle is
 * rated below a new solver's 1500, so a wrong move's half credit lowers
 * their rating; two are within 100 of it, so a settled 1500 has a next
 * puzzle in its rating window after solving one.
 */
function racePuzzle(
  id: string,
  position: string,
  line: readonly string[],
  rating: number
): PuzzleRecord {
  return {
    id: `counting-race/${id}`,
    position,
    line,
    rating,
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
  // Each has two solver moves, so a pool of the three plays as the
  // specifications' puzzle pool does, and at each a move the rules allow
  // is wrong. Three from five passes seven; a count for the waiting side
  // is never the rules' (only the side to move counts).
  puzzles: [
    {
      // The Tortoise counts to one; the Hare leaps to three, and after the
      // Tortoise's leap to five leaps home. Counting one, to two, is the
      // wrong move; three from five would pass seven.
      record: racePuzzle(
        'leap-home',
        'race:0b',
        ['advance', 'leap', 'leap', 'leap'],
        1200
      ),
      solverSide: 'white',
      solution: ['leap', 'leap'],
      labels: ['step 1', 'leap to 3', 'leap to 5', 'leap to 7'],
      wrongMove: { at: 1, action: 'advance' },
      refusedMove: { at: 3, action: 'hop' },
      opponentMove: { at: 1, action: 'tortoise-advance' },
    },
    {
      // The Hare counts to two; the Tortoise leaps to four and, after the
      // Hare's step to five, leaps home. Hopping to five instead is the
      // wrong move; a count back is no count at all.
      record: racePuzzle(
        'leap-past-four',
        'race:1w',
        ['advance', 'leap', 'advance', 'leap'],
        1450
      ),
      solverSide: 'black',
      solution: ['leap', 'leap'],
      labels: ['step 2', 'leap to 4', 'step 5', 'leap to 7'],
      wrongMove: { at: 1, action: 'hop' },
      refusedMove: { at: 1, action: 'retreat' },
      opponentMove: { at: 1, action: 'hare-advance' },
    },
    {
      // From three the Hare counts one, the Tortoise one, and the Hare
      // leaps home; leaping first and stepping home after the Tortoise's
      // count reaches the same finish (seven, the Tortoise to move). At
      // three a hop to six is wrong; at five, counting one instead of
      // leaping is.
      record: racePuzzle(
        'either-order',
        'race:2b',
        ['advance', 'advance', 'advance', 'leap'],
        1450
      ),
      solverSide: 'white',
      solution: ['advance', 'leap'],
      labels: ['step 3', 'step 4', 'step 5', 'leap to 7'],
      wrongMove: { at: 3, action: 'advance' },
      refusedMove: { at: 1, action: 'retreat' },
      opponentMove: { at: 1, action: 'tortoise-leap' },
      transposition: { at: 1, action: 'leap' },
    },
  ],
};

const COUNTING_RACE_STATS_PATH = '/more/counting-race-stats';

/** The race's puzzle stats outside any space, from Settings, as chess's. */
function CountingRaceStatsSettings(): JSX.Element {
  const router = useRouter();
  return (
    <MenuSection title="Counting race">
      <MenuRow
        title="Puzzle stats"
        caption="Your rating and game log, available offline"
        onClick={() => router.push(COUNTING_RACE_STATS_PATH)}
        dataSet={{
          testid: Handles.settingsPuzzleStats(COUNTING_RACE_SHARED.id),
        }}
      />
    </MenuSection>
  );
}

function CountingRaceStatsScreen(): JSX.Element {
  return (
    <PersonalPuzzleStatsScreen
      gameId={COUNTING_RACE_SHARED.id}
      puzzles={COUNTING_RACE_CLIENT.puzzles}
      screenId="personal-counting-race-stats"
    />
  );
}

export const COUNTING_RACE_GAME: HarnessGame = assertHarnessGame({
  label: 'counting race',
  shared: COUNTING_RACE_SHARED,
  client: defineGameClient(COUNTING_RACE_CLIENT),
  fixtures: COUNTING_RACE_FIXTURES,
  slice: {
    name: 'game:counting-race',
    client: {
      name: 'counting-race-stats',
      routes: [
        { path: COUNTING_RACE_STATS_PATH, component: CountingRaceStatsScreen },
      ],
      settings: CountingRaceStatsSettings,
    },
  },
});
