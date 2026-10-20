/**
 * The conformance planner refuses every way the matrix could be incomplete,
 * each with a message saying what to fix: fed fake registries, suites and
 * specification tables, it fails on a game missing from either registry, an
 * empty suite, an offered capability no suite requires a case of, and a
 * specification table naming an unknown capability, nothing, or a file that
 * is not there — and a shared specification added to the table reaches
 * every game offering what it shows, and no other.
 */

import { expect, test } from 'bun:test';
import type { HarnessGame } from '@libs/game-session-harness/harness-game';
import type {
  ConformancePlan,
  PlannedCodeSuite,
} from '@libs/games-harness/game-conformance';
import {
  emptySuiteProblems,
  enrollmentProblems,
  planConformance,
  specificationTableProblems,
} from '@libs/games-harness/game-conformance';
import { HARNESS_GAMES } from '@libs/games-harness/harness-games';
import { GAME_DEFINITIONS } from '@libs/games-shared/game-plugins';
import { COUNTING_RACE_GAME } from './reference-game/counting-race-game';

const RACE = COUNTING_RACE_GAME;
const RULES_SUITE: PlannedCodeSuite = {
  id: 'conformance/rules/laws',
  area: 'rules',
  registers: { 'counting-race': true },
};
const HISTORY_SUITE: PlannedCodeSuite = {
  id: 'conformance/history/kept',
  area: 'history',
  registers: { 'counting-race': true },
};
const PUZZLES_SUITE: PlannedCodeSuite = {
  id: 'conformance/puzzles/judged',
  area: 'puzzles',
  registers: { 'counting-race': true },
};
const CUSTOM_GAMES_FEATURE = 'specs/games/race-custom.feature';

/** A complete plan for the reference game alone; each test breaks one part. */
const SOUND: ConformancePlan = {
  registered: [],
  harness: [],
  games: [RACE],
  codeSuites: [RULES_SUITE, HISTORY_SUITE, PUZZLES_SUITE],
  specifications: [CUSTOM_GAMES_FEATURE],
  table: { 'race-custom': ['custom-games'] },
};

test('a complete plan has no problems', () => {
  expect(planConformance(SOUND).problems).toEqual([]);
});

// regression: game-conformance-execution-omission
test('registry agreement cannot hide a production game omitted from execution', () => {
  const plan = planConformance({
    ...SOUND,
    registered: [RACE.shared],
    harness: [RACE],
    games: [],
  });
  expect(plan.problems).toContain(
    'counting-race: HARNESS_GAMES has no execution game — enroll its HarnessGame in the shared conformance world'
  );
});

// regression: game-conformance-partial-suite
test('another passing suite cannot stand in for an omitted eligible game', () => {
  const plan = planConformance({
    ...SOUND,
    codeSuites: [
      ...SOUND.codeSuites,
      { ...RULES_SUITE, id: 'conformance/rules/new-regression', registers: {} },
    ],
  });
  expect(plan.problems).toContain(
    'conformance/rules/new-regression [counting-race]: missing required case — register its tests inside forEveryGame'
  );
});

test('suite evidence attributed to a game outside its requirements fails', () => {
  const plan = planConformance({
    ...SOUND,
    codeSuites: [
      ...SOUND.codeSuites,
      {
        id: 'conformance/matchmaking/leaked',
        area: 'matchmaking',
        registers: { 'counting-race': true },
      },
    ],
  });
  expect(plan.problems).toContain(
    'conformance/matchmaking/leaked [counting-race]: unexpected case — evidence belongs only to an eligible execution game'
  );
});

test('duplicate execution ids and a different shared definition fail', () => {
  expect(planConformance({ ...SOUND, games: [RACE, RACE] }).problems).toContain(
    'counting-race: duplicate execution game id — every game must have its own evidence'
  );
  expect(
    planConformance({
      ...SOUND,
      registered: [RACE.shared],
      harness: [RACE],
      games: [{ ...RACE, shared: { ...RACE.shared } as typeof RACE.shared }],
    }).problems
  ).toContain(
    'counting-race: execution holds another shared definition — use the HarnessGame registered in HARNESS_GAMES'
  );
});

test('a registered game missing from the harness games fails, naming where to add it', () => {
  expect(
    enrollmentProblems(GAME_DEFINITIONS, HARNESS_GAMES.slice(0, 1))
  ).toEqual([
    `"${GAME_DEFINITIONS[1].id}" is in GAME_DEFINITIONS but not HARNESS_GAMES — add its HarnessGame to HARNESS_GAMES (@libs/games-harness/harness-games) so the shared suites hold it`,
  ]);
});

test('a harness game that is not registered fails, naming where it belongs', () => {
  expect(
    enrollmentProblems(GAME_DEFINITIONS, [...HARNESS_GAMES, RACE])
  ).toEqual([
    `"counting-race" (counting race) is in HARNESS_GAMES but not GAME_DEFINITIONS — register its defineTurnGame value, or list a test-only game beside the reference game (tests/conformance-world.ts)`,
  ]);
});

test('harness games out of registry order, or holding another definition, fail', () => {
  expect(
    enrollmentProblems(GAME_DEFINITIONS, [...HARNESS_GAMES].reverse())
  ).toContain(
    `HARNESS_GAMES[0] is "${GAME_DEFINITIONS[1].id}" but GAME_DEFINITIONS[0] is "${GAME_DEFINITIONS[0].id}" — list the harness games in registry order`
  );
  const copy: HarnessGame = { ...RACE };
  expect(enrollmentProblems([RACE.shared], [copy])).toEqual([]);
  expect(enrollmentProblems([{ id: 'counting-race' }], [RACE])).toEqual([
    '"counting-race": HARNESS_GAMES holds another definition than GAME_DEFINITIONS registers — use the registered defineTurnGame value itself',
  ]);
});

test('an offered capability no suite requires a case of fails', () => {
  const { matrix, problems } = planConformance({
    ...SOUND,
    codeSuites: [RULES_SUITE, PUZZLES_SUITE],
  });
  expect(matrix[0]!.cells.history.status).toBe('missing');
  expect(problems).toEqual([
    'counting race offers history but no shared suite or specification requires a case of it — add a suite under tests/conformance/history/ or list a specs/games specification showing it in SHARED_SPECIFICATIONS',
  ]);
});

test('a suite file registering no case binds nothing, and fails', () => {
  const empty: PlannedCodeSuite = {
    ...HISTORY_SUITE,
    registers: { 'counting-race': false },
  };
  const { matrix, problems } = planConformance({
    ...SOUND,
    codeSuites: [RULES_SUITE, empty],
  });
  // Counted by file it would be bound; counted by case it is not.
  expect(matrix[0]!.cells.history.status).toBe('missing');
  expect(problems).toContain(
    'conformance/history/kept registers no case for any game it binds (counting-race) — add its tests inside forEveryGame, or delete it'
  );
});

test('a suite file never calling forEveryGame fails', () => {
  expect(emptySuiteProblems([{ ...HISTORY_SUITE, registers: null }])).toEqual([
    'conformance/history/kept never calls forEveryGame — a conformance suite registers its cases through forEveryGame(import.meta.path, …)',
  ]);
});

test('a suite registering a case for only some of its games is not empty', () => {
  expect(
    emptySuiteProblems([
      { ...HISTORY_SUITE, registers: { chess: true, 'counting-race': false } },
    ])
  ).toEqual([]);
});

test('a specification table listing an unknown capability, nothing, or only a trait fails', () => {
  const uris = [
    'specs/games/a.feature',
    'specs/games/b.feature',
    'specs/games/c.feature',
  ];
  expect(
    specificationTableProblems(
      {
        a: ['custom-games', 'tournaments'],
        b: [],
        c: ['a side that cannot win'],
      },
      uris
    )
  ).toEqual([
    'SHARED_SPECIFICATIONS["a"] lists "tournaments", which is neither a capability (custom-games, matchmaking, history, puzzles) nor a trait (a puzzle opponent, a side that cannot win, a draw by the game\'s own rules, a known puzzle won another way)',
    'SHARED_SPECIFICATIONS["b"] lists nothing — list the capabilities it shows',
    'SHARED_SPECIFICATIONS["c"] lists no capability — a specification counts toward the capabilities it shows',
  ]);
});

test('a specification without an entry, and an entry without a specification, fail', () => {
  expect(
    specificationTableProblems({ gone: ['custom-games'] }, [
      'specs/games/new.feature',
    ])
  ).toEqual([
    'specs/games/new.feature: list the capabilities it shows in SHARED_SPECIFICATIONS (@libs/games-harness/game-conformance)',
    'SHARED_SPECIFICATIONS["gone"] names no specification in specs/games — remove it, or restore the specification',
  ]);
});

test('a specification with an unknown capability binds no game', () => {
  const { matrix } = planConformance({
    ...SOUND,
    table: { 'race-custom': ['custom-games', 'tournaments'] },
  });
  expect(matrix[0]!.cells['custom-games'].status).toBe('missing');
});

test('a shared specification added to the table reaches every game offering what it shows, and no other', () => {
  const games = [...HARNESS_GAMES, RACE];
  const plan: ConformancePlan = {
    registered: GAME_DEFINITIONS,
    harness: HARNESS_GAMES,
    games,
    codeSuites: [],
    specifications: [
      'specs/games/new-custom.feature',
      'specs/games/new-matched.feature',
    ],
    table: {
      'new-custom': ['custom-games'],
      'new-matched': ['matchmaking', 'history'],
    },
  };
  const { matrix } = planConformance(plan);
  const bound = (area: 'custom-games' | 'matchmaking' | 'history') =>
    matrix.flatMap((row) => {
      const cell = row.cells[area];
      return cell.status === 'bound' ? [[row.game, cell.suites] as const] : [];
    });
  expect(bound('custom-games')).toEqual(
    games.map((game) => [game.label, ['specs/games/new-custom.feature']])
  );
  expect(bound('matchmaking').map(([game]) => game)).toEqual(
    HARNESS_GAMES.map((game) => game.label)
  );
  expect(matrix.at(-1)!.cells.matchmaking.status).toBe('unsupported');
  // History is bound for every registered game through the matched feature,
  // but the reference game, which finds no opponent, owes it elsewhere.
  expect(matrix.at(-1)!.cells.history.status).toBe('missing');
});
