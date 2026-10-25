import type { HarnessComposition } from '@libs/harness-ts/composition';
import type { ProductHarness } from '@libs/harness-ts/harness';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import {
  type HarnessGame,
  isTurnHarnessGame,
  type TurnHarnessGame,
} from './harness-game';

const registered = new WeakMap<HarnessComposition, readonly HarnessGame[]>();

/** Remember which games a composition registers (`gameSystem` only). */
export function registerHarnessGames(
  composition: HarnessComposition,
  games: readonly HarnessGame[]
): void {
  registered.set(composition, games);
}

/** The registered game whose rules recognize `position`, in the world `s` runs. */
export function harnessGameAt(
  s: ProductHarness,
  position: string
): HarnessGame {
  const game = registered
    .get(s.harness.composition)
    ?.find((candidate) =>
      candidate.shared.registration.rules.recognizes(position)
    );
  if (game === undefined)
    throw new Error(`no game this world registers plays ${position}`);
  return game;
}

/**
 * The known setup `side` readies with in a game of `position` with private
 * setups (`fixtures.setups`), or `undefined` for any other game.
 */
export function knownSetupAt(
  s: ProductHarness,
  position: string,
  side: GameSide
): string | undefined {
  const game = harnessGameAt(s, position);
  return isTurnHarnessGame(game) ? game.fixtures.setups?.[side] : undefined;
}

/** The registered game `id` of the world `s` runs, by its id. */
export function harnessGameOf(s: ProductHarness, id: string): HarnessGame {
  const game = registered
    .get(s.harness.composition)
    ?.find((candidate) => candidate.shared.id === id);
  if (game === undefined)
    throw new Error(`${id} is not a game this world registers`);
  return game;
}

/** A caller that plays discrete actions must request an actual turn capability. */
export function turnHarnessGameAt(
  s: ProductHarness,
  position: string
): TurnHarnessGame {
  const game = harnessGameAt(s, position);
  if (!isTurnHarnessGame(game))
    throw new Error(`${game.label} has no discrete turns`);
  return game;
}

export function turnHarnessGameOf(
  s: ProductHarness,
  id: string
): TurnHarnessGame {
  const game = harnessGameOf(s, id);
  if (!isTurnHarnessGame(game))
    throw new Error(`${game.label} has no discrete turns`);
  return game;
}
