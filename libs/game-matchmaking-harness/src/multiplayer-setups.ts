import { chooseMultiplayerSetupMutation } from '@libs/game-matchmaking-shared/choose-multiplayer-setup-mutation';
import type {
  MultiplayerGame,
  MultiplayerSide,
} from '@libs/game-matchmaking-shared/game-state';
import { setupReadySides } from '@libs/game-matchmaking-shared/game-state';
import { scenarioAction } from '@libs/harness/actor-ui';
import type { HarnessComposition } from '@libs/harness/composition';
import { signedInAccountOf } from '@libs/harness/identity';
import sql from '@pkgs/sql-root-shared/sql';
import { multiplayerFixture } from './multiplayer-fixtures-core';
import { multiplayerSpaceId } from './multiplayer-spaces';

/** The known private setup a side chooses in a game of `position`, if it has one. */
export type KnownSetup = (
  position: string,
  side: MultiplayerSide
) => string | undefined;

const known = new WeakMap<HarnessComposition, KnownSetup>();

/** Remember how a world's games name their known setups (`gameSystem` only). */
export function registerKnownSetups(
  composition: HarnessComposition,
  lookup: KnownSetup
): void {
  known.set(composition, lookup);
}

/**
 * Each named person still choosing a private setup in their unfinished
 * matched game chooses their side's known one, through the real choice: a
 * new matched game in a scenario is ready to play. Nothing happens for a
 * person without such a game, or without a signed-in account.
 */
export const chooseKnownSetups = scenarioAction({
  name: 'chooseKnownSetups',
  act: async (s, people: readonly string[]) => {
    const lookup = known.get(s.harness.composition);
    if (lookup === undefined) return;
    for (const actor of people) {
      // A person signed out, or whose account is deleted, has no game to ready.
      if ((await signedInAccountOf(s, actor)) === null) continue;
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
