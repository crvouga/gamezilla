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

/** The registered game `id` of the world `s` runs, by its id. */
export function harnessGameOf(s: ProductHarness, id: string): HarnessGame {
  const game = registered
    .get(s.harness.composition)
    ?.find((candidate) => candidate.shared.id === id);
  if (game === undefined)
    throw new Error(`${id} is not a game this world registers`);
  return game;
}
