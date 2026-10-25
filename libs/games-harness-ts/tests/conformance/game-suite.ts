/**
 * A shared code suite runs once for every conformance game its area binds:
 * its directory names the area (`rules`, or the capability it verifies),
 * and each game's run is its own `describe` named `<game> › <area> ›
 * <suite>`, so a failure names the game and the contract.
 *
 * The conformance matrix reads which games each suite requires a case of
 * by loading it for planning (`planCodeSuites`) inside a running test,
 * where `bun:test` refuses to register a test: each game's suite body is
 * run, and a body that tries to register one requires a case of its game.
 */

import { test as bunTest, describe } from 'bun:test';
import { basename, dirname, join } from 'node:path';
import type {
  HarnessGame,
  SimulationHarnessGame,
  TurnHarnessGame,
} from '@libs/game-session-harness-ts/harness-game';
import {
  isSimulationHarnessGame,
  isTurnHarnessGame,
} from '@libs/game-session-harness-ts/harness-game';
import type {
  ConformanceArea,
  ConformanceNeed,
  PlannedCodeSuite,
} from '@libs/games-harness-ts/game-conformance';
import {
  CONFORMANCE_AREAS,
  offersAll,
} from '@libs/games-harness-ts/game-conformance';
import { CONFORMANCE_GAMES } from '../conformance-world';

/** The area a suite file verifies, from its directory. */
export function suiteArea(suiteFile: string): ConformanceArea {
  const area = basename(dirname(suiteFile));
  if (!(CONFORMANCE_AREAS as readonly string[]).includes(area))
    throw new Error(
      `${suiteFile}: a conformance suite lives in tests/conformance/<${CONFORMANCE_AREAS.join('|')}>/`
    );
  return area as ConformanceArea;
}

/** The suite's name, from its file. */
export function suiteName(suiteFile: string): string {
  return basename(suiteFile).replace(/\.test\.tsx?$/, '');
}

/** `conformance/<area>/<suite>`: how the matrix names a code suite. */
export function suiteId(suiteFile: string): string {
  return `conformance/${suiteArea(suiteFile)}/${suiteName(suiteFile)}`;
}

/** While planning, whether each suite registers a case, per game id. */
let planning: Map<
  string,
  Pick<PlannedCodeSuite, 'registers' | 'needs'>
> | null = null;

/** `bun:test`'s refusal of a test registered while another test runs. */
const REFUSED_INSIDE_A_TEST = /inside a test/;

/** Whether `suite` registers a case for `game` (planning only). */
function registersCase(
  suiteFile: string,
  game: HarnessGame,
  suite: (game: HarnessGame) => void
): boolean {
  try {
    suite(game);
    return false;
  } catch (error) {
    if (error instanceof Error && REFUSED_INSIDE_A_TEST.test(error.message))
      return true;
    throw new Error(
      `${suiteId(suiteFile)} [${game.shared.id}]: planning failed`,
      {
        cause: error,
      }
    );
  }
}

/** Register `suite` once for every conformance game its area binds. */
export function forEveryGame(
  suiteFile: string,
  suite: (game: HarnessGame) => void,
  needs: readonly ConformanceNeed[] = []
): void {
  const area = suiteArea(suiteFile);
  const bound = CONFORMANCE_GAMES.filter((candidate) =>
    offersAll(candidate, [area, ...needs])
  );
  if (planning !== null) {
    const registers: Record<string, boolean> = {};
    for (const game of bound)
      registers[game.shared.id] = registersCase(suiteFile, game, suite);
    planning.set(suiteId(suiteFile), { registers, needs });
    return;
  }
  for (const game of bound)
    describe(`${game.label} › ${area} › ${suiteName(suiteFile)}`, () =>
      suite(game));
}

/** Discrete obligations run only with real turn mechanics and independent move fixtures. */
export function forEveryTurnGame(
  suiteFile: string,
  suite: (game: TurnHarnessGame) => void,
  needs: readonly ConformanceNeed[] = []
): void {
  forEveryGame(
    suiteFile,
    (game) => {
      if (!isTurnHarnessGame(game))
        throw new Error(`${game.label}: turn fixtures are missing`);
      suite(game);
    },
    ['turns', ...needs]
  );
}

/** A hybrid owes both sets of execution checks, without changing game identity. */
export function forEverySimulationGame(
  suiteFile: string,
  suite: (game: SimulationHarnessGame) => void,
  needs: readonly ConformanceNeed[] = []
): void {
  forEveryGame(
    suiteFile,
    (game) => {
      if (!isSimulationHarnessGame(game))
        throw new Error(`${game.label}: simulation fixtures are missing`);
      suite(game);
    },
    ['simulation', ...needs]
  );
}

/**
 * Every code suite under `conformance/` (`tests` is the tests directory)
 * and the cases it requires of each game, read by loading each suite in
 * planning mode: a fresh instance of its module (`?plan`) that registers
 * nothing. A suite file that never calls `forEveryGame` requires none.
 */
export function planCodeSuites(
  tests: string
): Promise<readonly PlannedCodeSuite[]> {
  // A module loads once per process, so the plan is read once and shared.
  let plan = plannedSuites.get(tests);
  if (plan === undefined) {
    plan = readPlan(tests);
    plannedSuites.set(tests, plan);
  }
  return plan;
}

const plannedSuites = new Map<string, Promise<readonly PlannedCodeSuite[]>>();

async function readPlan(tests: string): Promise<readonly PlannedCodeSuite[]> {
  // Outside a running test this registers a failing test instead of
  // planning, where every suite would register its cases for real.
  try {
    bunTest('the conformance plan is read inside a test', () => {
      throw new Error('call planCodeSuites inside a test body');
    });
  } catch {
    // Inside a test: `bun:test` refused it, as it will every suite's cases.
  }
  const files = [
    ...new Bun.Glob('conformance/*/*.test.{ts,tsx}').scanSync(tests),
  ].sort();
  const plans = new Map<
    string,
    Pick<PlannedCodeSuite, 'registers' | 'needs'>
  >();
  planning = plans;
  try {
    for (const file of files) await import(`${join(tests, file)}?plan`);
  } finally {
    planning = null;
  }
  return files.map((file) => {
    const path = join(tests, file);
    return {
      id: suiteId(path),
      area: suiteArea(path),
      ...plans.get(suiteId(path)),
      registers: plans.get(suiteId(path))?.registers ?? null,
    };
  });
}
