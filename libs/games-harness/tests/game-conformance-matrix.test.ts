/**
 * The game × capability conformance matrix, derived from what each game
 * offers and which shared suites exist, never from a list kept by hand: a
 * code suite is a file under `tests/conformance/<area>/`, a shared
 * specification any spec of `specs/games/` — a feature, a Quint model, a
 * decision table, a structure or an objective. An offered capability no
 * suite verifies fails; an unoffered one owes nothing.
 */

import { expect, test } from 'bun:test';
import { join } from 'node:path';
import type {
  ConformanceArea,
  ConformanceSuite,
} from '@libs/games-harness/game-conformance';
import {
  CONFORMANCE_AREAS,
  capabilitiesOf,
  conformanceMatrix,
  formatConformanceMatrix,
  SHARED_SPECIFICATION_KINDS,
  SHARED_SPECIFICATIONS,
  sharedSpecificationNeeds,
  sharedSpecificationStem,
} from '@libs/games-harness/game-conformance';
import { suiteArea, suiteName } from './conformance/game-suite';
import { CONFORMANCE_GAMES, gamesHeldTo } from './conformance-world';
import { COUNTING_RACE_GAME } from './reference-game/counting-race-game';

const TESTS = import.meta.dir;
const SHARED_SPECS = join(TESTS, '../../../specs/games');

function codeSuites(): readonly ConformanceSuite[] {
  return [...new Bun.Glob('conformance/*/*.test.ts').scanSync(TESTS)]
    .sort()
    .map((file) => {
      const area = suiteArea(join(TESTS, file));
      return {
        id: `conformance/${area}/${suiteName(file)}`,
        area,
        needs: [area],
      };
    });
}

/** Every spec a game is held to (the glossary and events are not). */
function sharedSpecifications(): readonly string[] {
  return [...new Bun.Glob('*').scanSync(SHARED_SPECS)]
    .filter((file) =>
      SHARED_SPECIFICATION_KINDS.some((kind) => file.endsWith(kind))
    )
    .filter((file) => file !== 'events.qnt')
    .sort()
    .map((file) => `specs/games/${file}`);
}

function specificationSuites(): readonly ConformanceSuite[] {
  return sharedSpecifications().flatMap((uri) => {
    const needs = sharedSpecificationNeeds(uri);
    return capabilitiesOf(needs).map((area) => ({ id: uri, area, needs }));
  });
}

const SUITES = [...codeSuites(), ...specificationSuites()];

test('every shared specification says what it shows, and nothing else is listed', () => {
  expect(Object.keys(SHARED_SPECIFICATIONS).sort()).toEqual(
    [...new Set(sharedSpecifications().map(sharedSpecificationStem))].sort()
  );
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

test('every area the platform offers has a shared suite', () => {
  for (const area of CONFORMANCE_AREAS)
    expect(SUITES.some((suite) => suite.area === area)).toBe(true);
});

test('every game is verified for everything it offers', () => {
  const matrix = conformanceMatrix(CONFORMANCE_GAMES, SUITES);
  process.stdout.write(`\n${formatConformanceMatrix(matrix)}\n\n`);
  const missing = matrix.flatMap((row) =>
    CONFORMANCE_AREAS.filter(
      (area) => row.cells[area].status === 'missing'
    ).map(
      (area) => `${row.game} offers ${area} but no shared suite verifies it`
    )
  );
  expect(missing).toEqual([]);
});

test('what a game does not offer is unsupported, not untested', () => {
  const [row] = conformanceMatrix([COUNTING_RACE_GAME], SUITES);
  const statuses = Object.fromEntries(
    CONFORMANCE_AREAS.map((area) => [area, row!.cells[area].status])
  ) as Record<ConformanceArea, string>;
  expect(statuses).toEqual({
    rules: 'bound',
    'custom-games': 'bound',
    matchmaking: 'unsupported',
    history: 'bound',
  });
});

test('an offered capability without a suite is missing evidence', () => {
  const [row] = conformanceMatrix(
    [COUNTING_RACE_GAME],
    SUITES.filter((suite) => suite.area !== 'history')
  );
  expect(row!.cells.history.status).toBe('missing');
  expect(row!.cells.matchmaking.status).toBe('unsupported');
});

test('a shared feature binds only games offering everything it shows', () => {
  const [row] = conformanceMatrix([COUNTING_RACE_GAME], SUITES);
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

test('a specification needing a trait binds only games whose fixtures show it', () => {
  const cannotWin = 'specs/games/custom-game-cannot-win.feature';
  expect(sharedSpecificationNeeds(cannotWin)).toContain(
    'a side that cannot win'
  );
  expect(gamesHeldTo(cannotWin).map((game) => game.label)).toEqual(
    CONFORMANCE_GAMES.filter(
      (game) => game.fixtures.secondSideCannotWin !== undefined
    ).map((game) => game.label)
  );
  // The reference game's sides can always win, so it owes nothing here.
  const [row] = conformanceMatrix([COUNTING_RACE_GAME], SUITES);
  const customGames = row!.cells['custom-games'];
  if (customGames.status === 'bound')
    expect(customGames.suites).not.toContain(cannotWin);
});
