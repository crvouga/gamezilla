/**
 * A shared code suite runs once for every conformance game its area binds:
 * its directory names the area (`rules`, or the capability it verifies),
 * and each game's run is its own `describe` named `<game> › <area> ›
 * <suite>`, so a failure names the game and the contract.
 */

import { describe } from 'bun:test';
import { basename, dirname } from 'node:path';
import type { HarnessGame } from '@libs/game-session-harness/harness-game';
import type { ConformanceArea } from '@libs/games-harness/game-conformance';
import {
  CONFORMANCE_AREAS,
  offersAll,
} from '@libs/games-harness/game-conformance';
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

/** Register `suite` once for every conformance game its area binds. */
export function forEveryGame(
  suiteFile: string,
  suite: (game: HarnessGame) => void
): void {
  const area = suiteArea(suiteFile);
  for (const game of CONFORMANCE_GAMES.filter((candidate) =>
    offersAll(candidate, [area])
  ))
    describe(`${game.label} › ${area} › ${suiteName(suiteFile)}`, () =>
      suite(game));
}
