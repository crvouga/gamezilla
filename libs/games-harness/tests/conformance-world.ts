/**
 * The games every shared suite and shared specification runs for: every
 * registered game, as production registers it, and the test-only reference
 * game beside them. Each is held to exactly what it offers.
 */

import { join } from 'node:path';
import {
  gameSystem,
  openGameHarness,
} from '@libs/game-session-harness/game-system';
import type { HarnessGame } from '@libs/game-session-harness/harness-game';
import {
  requiredGames,
  SHARED_SPECIFICATION_KINDS,
  specificationGames,
} from '@libs/games-harness/game-conformance';
import { HARNESS_GAMES } from '@libs/games-harness/harness-games';
import type { OpenHarnessOptions } from '@libs/harness/mode';
import type { OpenHarness } from '@libs/harness/open-harness';
import { recordVariantRequirements } from '@pkgs/conformance-server/evidence-store';
import { SOLO_COUNT_GAME } from './probes/solo-count-game';
import { COUNTING_RACE_GAME } from './reference-game/counting-race-game';
import { SECRET_PICK_GAME } from './reference-game/secret-pick-game';

export const CONFORMANCE_GAMES: readonly HarnessGame[] = [
  ...HARNESS_GAMES,
  COUNTING_RACE_GAME,
  SOLO_COUNT_GAME,
  SECRET_PICK_GAME,
];

/**
 * The games a shared specification (`specs/games/<file>`, any kind) holds
 * for: every conformance game offering what it shows.
 */
export function gamesHeldTo(specUri: string): readonly HarnessGame[] {
  return specificationGames(specUri, CONFORMANCE_GAMES);
}

const SHARED_SPECS = join(import.meta.dir, '../../../specs/games');

/** Every spec of `specs/games/` a game is held to (the glossary and events are not). */
export function sharedSpecifications(): readonly string[] {
  return [...new Bun.Glob('*').scanSync(SHARED_SPECS)]
    .filter((file) =>
      SHARED_SPECIFICATION_KINDS.some((kind) => file.endsWith(kind))
    )
    .filter((file) => file !== 'events.qnt')
    .sort()
    .map((file) => `specs/games/${file}`);
}

/**
 * Declare, beside the run's evidence (`HARNESS_REPORT_DIR`, set by
 * `test:spec`), which games every shared specification must have a verdict
 * of its own for, so the conformance report holds each game × specification
 * cell to its own evidence. Outside a spec run there is nothing to declare.
 */
export function declareRequiredGames(): void {
  const reportDir = process.env['HARNESS_REPORT_DIR'];
  if (reportDir === undefined || reportDir === '') return;
  recordVariantRequirements(reportDir, {
    packageName: '@libs/games-harness',
    ...requiredGames(sharedSpecifications(), CONFORMANCE_GAMES),
  });
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

/**
 * One world where every conformance game is offered at once, its puzzle
 * catalogue holding each game's known puzzles and nothing else.
 */
export const CONFORMANCE_SYSTEM = gameSystem('games', CONFORMANCE_GAMES, {
  knownPuzzles: true,
});

export function openConformanceHarness(
  testId: string,
  options?: OpenHarnessOptions
): Promise<OpenHarness> {
  return openGameHarness(CONFORMANCE_SYSTEM, testId, options);
}
