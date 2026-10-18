/**
 * The framework's side of a probe: what the shared laws say of a probe
 * game, and which shared suites and specifications its capabilities bind.
 * The probe games themselves (every probe module but this one and the
 * tests) are written as games, from the public game API alone
 * (`probe-imports.test.ts`); only the framework's side judges them.
 *
 * A probe game is not enrolled in `CONFORMANCE_GAMES`, so the shared
 * specifications and code suites are not run for it here: what it inherits
 * is what they bind by its capabilities and traits, exactly as they bind
 * an enrolled game (`offersAll`), and each of those suites runs for an
 * enrolled game offering the same capabilities.
 */

import { join } from 'node:path';
import type { HarnessGame } from '@libs/game-session-harness/harness-game';
import {
  CONFORMANCE_AREAS,
  type ConformanceArea,
  offersAll,
  specificationGames,
} from '@libs/games-harness/game-conformance';
import { offeredCapabilities } from '@pkgs/turn-game-shared/game-rules';
import { planCodeSuites } from '../conformance/game-suite';
import { sharedSpecifications } from '../conformance-world';

/** The rules law every turn game keeps: sides take turns. */
export const TAKES_TURNS_LAW =
  'the first side moves first and every action passes the turn to the other side';

/** The shared specifications `game` is held to, by what it offers. */
export function inheritedSpecifications(game: HarnessGame): readonly string[] {
  return sharedSpecifications().filter(
    (uri) => specificationGames(uri, [game]).length === 1
  );
}

/**
 * The shared code suites whose area `game` offers (`rules`: every game);
 * planning reads them, so call it inside a test.
 */
export async function inheritedCodeSuites(
  game: HarnessGame
): Promise<readonly string[]> {
  const planned = await planCodeSuites(join(import.meta.dir, '..'));
  return planned
    .filter((suite) => offersAll(game, [suite.area]))
    .map((suite) => suite.id);
}

/** The areas `game` is bound in, and those it does not offer. */
export function areasOf(game: HarnessGame): {
  readonly bound: readonly ConformanceArea[];
  readonly unsupported: readonly ConformanceArea[];
} {
  const offered = offeredCapabilities(game.shared.turnGame);
  const bound = CONFORMANCE_AREAS.filter(
    (area) => area === 'rules' || offered.includes(area)
  );
  return {
    bound,
    unsupported: CONFORMANCE_AREAS.filter((area) => !bound.includes(area)),
  };
}
