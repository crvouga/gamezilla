/**
 * The game × capability conformance matrix, derived from what each game
 * offers and which shared suites require a case of it, never from a list
 * kept by hand: a code suite is a file under `tests/conformance/<area>/`,
 * counted for a game only when it registers a case of it (read by planning,
 * `planCodeSuites`); a shared specification is any spec of `specs/games/` —
 * a feature, a Quint model, a decision table, a structure or an objective.
 * An offered capability no suite requires a case of fails; an unoffered one
 * owes nothing. The planner's own refusals are proven in
 * `game-conformance-plan.test.ts`.
 */

import { expect, test } from 'bun:test';
import { isTurnHarnessGame } from '@libs/game-session-harness-ts/harness-game';
import type {
  ConformanceArea,
  ConformanceSuite,
} from '@libs/games-harness-ts/game-conformance';
import {
  CONFORMANCE_AREAS,
  codeConformanceSuites,
  conformanceMatrix,
  formatConformanceMatrix,
  offersAll,
  planConformance,
  SHARED_SPECIFICATION_KINDS,
  SHARED_SPECIFICATIONS,
  sharedSpecificationNeeds,
  specificationConformanceSuites,
} from '@libs/games-harness-ts/game-conformance';
import { HARNESS_GAMES } from '@libs/games-harness-ts/harness-games';
import { GAME_DEFINITIONS } from '@libs/games-shared-ts/game-plugins';
import { planCodeSuites } from './conformance/game-suite';
import {
  CONFORMANCE_GAMES,
  gamesHeldTo,
  sharedSpecifications,
} from './conformance-world';
import { COUNTING_RACE_GAME } from './reference-game/counting-race-game';

const TESTS = import.meta.dir;
/** Every shared suite; planning must run inside a test. */
async function suites(): Promise<readonly ConformanceSuite[]> {
  return [
    ...codeConformanceSuites(await planCodeSuites(TESTS)),
    ...specificationConformanceSuites(sharedSpecifications()),
  ];
}

test('the conformance plan is complete: enrollment, the specification table, every suite and every offered capability', async () => {
  const { matrix, problems } = planConformance({
    registered: GAME_DEFINITIONS,
    harness: HARNESS_GAMES,
    games: CONFORMANCE_GAMES,
    codeSuites: await planCodeSuites(TESTS),
    specifications: sharedSpecifications(),
    table: SHARED_SPECIFICATIONS,
  });
  process.stdout.write(`\n${formatConformanceMatrix(matrix)}\n\n`);
  expect(problems).toEqual([]);
});

test('every code suite registers every eligible game, with unsupported areas owing no cases', async () => {
  const planned = await planCodeSuites(TESTS);
  expect(planned.length).toBeGreaterThan(0);
  for (const suite of planned) {
    expect(suite.registers).not.toBeNull();
    const eligible = CONFORMANCE_GAMES.filter((game) =>
      offersAll(game, [suite.area, ...(suite.needs ?? [])])
    );
    expect(Object.keys(suite.registers ?? {}).sort()).toEqual(
      eligible.map((game) => game.shared.id).sort()
    );
    for (const game of eligible)
      expect(suite.registers?.[game.shared.id]).toBe(true);
  }
});

test('a model, decision table, structure and objective are listed like features', () => {
  const kinds = new Set(
    sharedSpecifications().map((uri) =>
      SHARED_SPECIFICATION_KINDS.find((kind) => uri.endsWith(kind))
    )
  );
  expect([...kinds].sort()).toEqual([...SHARED_SPECIFICATION_KINDS].sort());
});

test('an unlisted shared specification fails, whatever its kind', () => {
  for (const kind of SHARED_SPECIFICATION_KINDS)
    expect(() =>
      sharedSpecificationNeeds(`specs/games/never-listed${kind}`)
    ).toThrow('list the capabilities it shows in SHARED_SPECIFICATIONS');
  expect(() => sharedSpecificationNeeds('specs/games/notes.txt')).toThrow(
    'not a specification a game is held to'
  );
});

test('every area the platform offers has a shared suite', async () => {
  const all = await suites();
  for (const area of CONFORMANCE_AREAS)
    expect(all.some((suite) => suite.area === area)).toBe(true);
});

test('what a game does not offer is unsupported, not untested', async () => {
  const [row] = conformanceMatrix([COUNTING_RACE_GAME], await suites());
  const statuses = Object.fromEntries(
    CONFORMANCE_AREAS.map((area) => [area, row!.cells[area].status])
  ) as Record<ConformanceArea, string>;
  expect(statuses).toEqual({
    rules: 'bound',
    simulation: 'unsupported',
    'custom-games': 'bound',
    matchmaking: 'unsupported',
    history: 'bound',
    puzzles: 'bound',
  });
});

test('an offered capability without a suite is missing evidence', async () => {
  const [row] = conformanceMatrix(
    [COUNTING_RACE_GAME],
    (await suites()).filter((suite) => suite.area !== 'history')
  );
  expect(row!.cells.history.status).toBe('missing');
  expect(row!.cells.matchmaking.status).toBe('unsupported');
});

test('a shared feature binds only games offering everything it shows', async () => {
  const [row] = conformanceMatrix([COUNTING_RACE_GAME], await suites());
  const customGames = row!.cells['custom-games'];
  expect(customGames.status).toBe('bound');
  if (customGames.status === 'bound') {
    expect(customGames.suites).toContain('specs/games/custom-games.feature');
    // The game's choices show finding an opponent, which it does not offer.
    expect(customGames.suites).not.toContain(
      'specs/games/game-choices.feature'
    );
    // The custom-game models bind it like the features do.
    expect(customGames.suites).toContain('specs/games/custom-game-play.qnt');
  }
});

test('a specification needing a trait binds only games whose fixtures show it', async () => {
  const cannotWin = 'specs/games/custom-game-cannot-win.feature';
  expect(sharedSpecificationNeeds(cannotWin)).toContain(
    'a side that cannot win'
  );
  expect(gamesHeldTo(cannotWin).map((game) => game.label)).toEqual(
    CONFORMANCE_GAMES.filter(
      (game) =>
        isTurnHarnessGame(game) &&
        game.fixtures.secondSideCannotWin !== undefined
    ).map((game) => game.label)
  );
  // The reference game's sides can always win, so it owes nothing here.
  const [row] = conformanceMatrix([COUNTING_RACE_GAME], await suites());
  const customGames = row!.cells['custom-games'];
  if (customGames.status === 'bound')
    expect(customGames.suites).not.toContain(cannotWin);
});

test("a draw by the game's own rules binds only games whose fixtures show one", () => {
  const rulesDraw = 'specs/games/matched-game-rules-draw.feature';
  expect(sharedSpecificationNeeds(rulesDraw)).toContain(
    "a draw by the game's own rules"
  );
  expect(gamesHeldTo(rulesDraw).map((game) => game.label)).toEqual(
    CONFORMANCE_GAMES.filter(
      (game) =>
        isTurnHarnessGame(game) &&
        game.fixtures.drawByRules !== undefined &&
        game.shared.registration.capabilities.matchmaking !== undefined
    ).map((game) => game.label)
  );
});
