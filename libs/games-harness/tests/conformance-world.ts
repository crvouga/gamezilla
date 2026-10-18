/**
 * The games every shared suite and shared specification runs for: every
 * registered game, as production registers it, and the test-only reference
 * game beside them. Each is held to exactly what it offers.
 */

import {
  gameSystem,
  openGameHarness,
} from '@libs/game-session-harness/game-system';
import type { HarnessGame } from '@libs/game-session-harness/harness-game';
import {
  offersAll,
  sharedSpecificationNeeds,
} from '@libs/games-harness/game-conformance';
import { HARNESS_GAMES } from '@libs/games-harness/harness-games';
import type { OpenHarnessOptions } from '@libs/harness/mode';
import type { OpenHarness } from '@libs/harness/open-harness';
import { COUNTING_RACE_GAME } from './reference-game/counting-race-game';

export const CONFORMANCE_GAMES: readonly HarnessGame[] = [
  ...HARNESS_GAMES,
  COUNTING_RACE_GAME,
];

/**
 * The games a shared specification (`specs/games/<file>`, any kind) holds
 * for: every conformance game offering what it shows.
 */
export function gamesHeldTo(specUri: string): readonly HarnessGame[] {
  const needs = sharedSpecificationNeeds(specUri);
  return CONFORMANCE_GAMES.filter((game) => offersAll(game, needs));
}

/**
 * The runs of a shared specification, one per game it holds for: the
 * variant id is the game's id (its evidence, `scenario:<scenario> [<id>]`,
 * `trace:<n> [<id>]`) and the label its name (its test, `<scenario>
 * [<label>]`), so each game's result is its own.
 */
export function conformanceVariants(
  specUri: string
): readonly { readonly id: string; readonly label: string }[] {
  return gamesHeldTo(specUri).map((game) => ({
    id: game.shared.id,
    label: game.label,
  }));
}

/**
 * The conformance game a run is for, by the variant its runner gave it (a
 * scenario's or a model trace's): `run` names it in the failure.
 */
export function conformanceGameOf(
  variant: { readonly id: string } | undefined,
  run: string
): HarnessGame {
  const game = CONFORMANCE_GAMES.find(
    (candidate) => candidate.shared.id === variant?.id
  );
  if (game === undefined) throw new Error(`${run}: no game for this run`);
  return game;
}

/** One world where every conformance game is offered at once. */
export const CONFORMANCE_SYSTEM = gameSystem('games', CONFORMANCE_GAMES);

export function openConformanceHarness(
  testId: string,
  options?: OpenHarnessOptions
): Promise<OpenHarness> {
  return openGameHarness(CONFORMANCE_SYSTEM, testId, options);
}
