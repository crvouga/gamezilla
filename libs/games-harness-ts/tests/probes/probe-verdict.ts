/**
 * The framework's side of a probe: what the shared laws say of a probe
 * game, and which shared suites and specifications its capabilities bind.
 * The probe games themselves (every probe module but this one and the
 * tests) are written as games, from the public game API alone
 * (`probe-imports.test.ts`); only the framework's side judges them.
 *
 * A probe need not be enrolled in `CONFORMANCE_GAMES`: what it inherits
 * is what they bind by its capabilities and traits, exactly as they bind
 * an enrolled game (`offersAll`). The solo-count consumer is also enrolled
 * there, so it executes the suites whose enrollment is inspected here.
 */

import { join } from 'node:path';
import type { HarnessGame } from '@libs/game-session-harness-ts/harness-game';
import {
  CONFORMANCE_AREAS,
  type ConformanceArea,
  offersAll,
  specificationGames,
} from '@libs/games-harness-ts/game-conformance';
import { offeredCapabilities } from '@pkgs/turn-game-shared-ts/game-rules';
import { planCodeSuites } from '../conformance/game-suite';
import { sharedSpecifications } from '../conformance-world';

/** The turn order promised by the current head-to-head specifications. */
export const TAKES_TURNS_LAW =
  'the first side moves first and every action passes the turn to the next declared side';

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
    .filter((suite) => offersAll(game, [suite.area, ...(suite.needs ?? [])]))
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
