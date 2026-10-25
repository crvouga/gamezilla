import { chooseMultiplayerSetupMutation } from '@libs/game-matchmaking-shared-ts/choose-multiplayer-setup-mutation';
import type {
  MultiplayerGame,
  MultiplayerSide,
} from '@libs/game-matchmaking-shared-ts/game-state';
import { setupReadySides } from '@libs/game-matchmaking-shared-ts/game-state';
import { saveMultiplayerHands } from '@libs/game-matchmaking-shared-ts/multiplayer-hands';
import { scenarioAction } from '@libs/harness-ts/actor-ui';
import type { HarnessComposition } from '@libs/harness-ts/composition';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { signedInAccountOf } from '@libs/harness-ts/identity';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { multiplayerFixture } from './multiplayer-fixtures-core';
import { multiplayerSpaceId } from './multiplayer-spaces';

/** The known private setup a side chooses in a game of `position`, if it has one. */
export type KnownSetup = (
  position: string,
  side: MultiplayerSide
) => string | undefined;

/** The known deal a new matched game of `position` starts from, if its game deals hands. */
export type KnownDealOf = (position: string) => string | undefined;

const known = new WeakMap<HarnessComposition, KnownSetup>();
const deals = new WeakMap<HarnessComposition, KnownDealOf>();

/** Remember how a world's games name their known deals (`gameSystem` only). */
export function registerKnownDeals(
  composition: HarnessComposition,
  lookup: KnownDealOf
): void {
  deals.set(composition, lookup);
}

/**
 * A new matched game of a game with dealt hands, before anyone has moved,
 * starts from the game's known deal: the deal the server's own id source
 * would have drawn is replaced by the one every shared line is written for,
 * as a fixture sets a position no person could reach.
 */
async function dealKnownHands(s: ProductHarness, actor: string): Promise<void> {
  const lookup = deals.get(s.harness.composition);
  if (lookup === undefined) return;
  await multiplayerFixture(s, actor, async (tx, env) => {
    const games = await tx.query(sql<MultiplayerGame>`
      SELECT * FROM chess_multiplayer_games
      WHERE (white_id = ${env.actorId} OR black_id = ${env.actorId} OR red_id = ${env.actorId} OR blue_id = ${env.actorId})
        AND outcome = 'ongoing' AND revision = 0 AND deleted_at IS NULL`);
    const rules = env.turnGames;
    if (rules === undefined) return [];
    for (const game of games) {
      const hidden = lookup(game.fen);
      if (hidden !== undefined)
        await saveMultiplayerHands(tx, game, {
          hidden,
          rules,
          nowMs: env.now().getTime(),
        });
    }
    return games.length > 0 ? [env.actorId] : [];
  });
}

/** Remember how a world's games name their known setups (`gameSystem` only). */
export function registerKnownSetups(
  composition: HarnessComposition,
  lookup: KnownSetup
): void {
  known.set(composition, lookup);
}

/**
 * Each named person still choosing a private setup in their unfinished
 * matched game chooses their side's known one, through the real choice, and
 * a new game with dealt hands starts from its known deal: a new matched game
 * in a scenario is ready to play. Nothing happens for a
 * person without such a game, or without a signed-in account.
 */
export const chooseKnownSetups = scenarioAction({
  name: 'chooseKnownSetups',
  act: async (s, people: readonly string[]) => {
    const lookup = known.get(s.harness.composition);
    for (const actor of people) {
      // A person signed out, or whose account is deleted, has no game to ready.
      if ((await signedInAccountOf(s, actor)) === null) continue;
      await dealKnownHands(s, actor);
      if (lookup === undefined) continue;
      const spaceId = await multiplayerSpaceId(s, actor);
      await multiplayerFixture(s, actor, async (tx, env) => {
        const games = await tx.query(sql<
          Pick<MultiplayerGame, 'id' | 'fen' | 'white_id' | 'setup_ready'>
        >`SELECT id, fen, white_id, setup_ready FROM chess_multiplayer_games
          WHERE (white_id = ${env.actorId} OR black_id = ${env.actorId})
            AND outcome = 'ongoing' AND setup_ready IS NOT NULL AND deleted_at IS NULL`);
        for (const game of games) {
          const side: MultiplayerSide =
            game.white_id === env.actorId ? 'white' : 'black';
          const setup = lookup(game.fen, side);
          if (setupReadySides(game).includes(side) || setup === undefined)
            continue;
          await chooseMultiplayerSetupMutation.run(
            { tx, env },
            {
              spaceId: spaceId ?? 'no-space',
              gameId: game.id,
              requestId: `known-setup-${game.id}-${side}`,
              setup,
            }
          );
        }
        return [env.actorId];
      });
    }
  },
});
