import type { HarnessComposition } from '@libs/harness/composition';
import type { ProductHarness } from '@libs/harness/harness';
import type { HarnessGame } from './harness-game';

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
    ?.find((candidate) => candidate.shared.turnGame.rules.recognizes(position));
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
  side: 'white' | 'black'
): string | undefined {
  return harnessGameAt(s, position).fixtures.setups?.[side];
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
