/**
 * The human-like-play model's world: Cedar against Bob, game after game,
 * as Bob sees Cedar's moves and their rematches.
 */
import { sendMultiplayerCommand } from '@libs/game-matchmaking-harness-ts/multiplayer-commands';
import { multiplayerView } from '@libs/game-matchmaking-harness-ts/multiplayer-reads';
import { actorUi, pollUntil, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { signedInAccountOf } from '@libs/harness-ts/identity';
import { bringToFront } from '@libs/harness-ts/observations';
import sql from '@pkgs/sql-root-shared-ts/sql';
import {
  carryOnSyntheticUsers,
  setPlaySetup,
  syntheticApplication,
} from './live-synthetic-users';
import { movesSeenBy, recordMovesSeen } from './moves-seen';
import { offerRematchTo } from './rematch-actions';
import { cedarUser } from './synthetic-user-fixtures';

/** The longest a move or an answer can take, and then some. */
const PATIENCE_MS = 25_000;

/** Cedar makes its next move, if it is Cedar's move in an ongoing game. */
export const cedarMovesOnce = scenarioAction({
  name: 'cedarMovesOnce',
  act: async (s) => {
    const cedar = await cedarUser(s);
    const app = await syntheticApplication(s, {
      actor: 'cedar',
      userId: cedar.id,
    });
    try {
      await recordMovesSeen(s);
      const seen = movesSeenBy(s, 'bob').length;
      const end = s.harness.clock.now() + PATIENCE_MS;
      while (s.harness.clock.now() < end) {
        await bringToFront(s, 'cedar');
        const game = (await multiplayerView(s, 'cedar')).game;
        if (game === null || game.outcome !== 'ongoing') return;
        await app.continueCurrentGame();
        await recordMovesSeen(s);
        if (movesSeenBy(s, 'bob').length > seen) return;
        await s.session.advanceTime(100);
        await s.session.waitForIdle();
      }
    } finally {
      app.close();
    }
  },
});

/** Bob leaves an ongoing game against Cedar: aborted before both moved, resigned after. */
export const bobLeavesGame = scenarioAction({
  name: 'bobLeavesGame',
  act: async (s) => {
    const game = (await multiplayerView(s, 'bob')).game;
    if (game === null || game.outcome !== 'ongoing') return;
    for (const name of ['abortMultiplayer', 'resignMultiplayer'])
      await Promise.resolve(
        sendMultiplayerCommand.act(s, 'bob', {
          name,
          args: { gameId: game.id, requestId: `${name}-${game.id}` },
        })
      );
  },
});

/** After a finished game Bob or Cedar offers a rematch; the other accepts or declines. */
export const rematchOffered = scenarioAction({
  name: 'rematchOffered',
  act: async (s, who: string, accepted: boolean) => {
    if (who === 'Bob') {
      setPlaySetup(s, 'Cedar', {
        persona: { rematchWeight: accepted ? 1 : 0 },
      });
      await Promise.resolve(offerRematchTo.act(s, 'bob'));
      return;
    }
    setPlaySetup(s, 'Cedar', { persona: { rematchWeight: 1 } });
    const bob = await actorUi(s, 'bob');
    await carryOnSyntheticUsers(s, {
      maxMs: PATIENCE_MS,
      only: (member) => member.actor === 'cedar',
      settled: async () => {
        await bringToFront(s, 'bob');
        return bob.get('multiplayer-accept-rematch').isVisible();
      },
    });
    await bringToFront(s, 'bob');
    // Cedar never offers a fourth game in a row: then there is nothing to answer.
    if (!(await bob.get('multiplayer-accept-rematch').isVisible())) return;
    await bob
      .get(
        accepted ? 'multiplayer-accept-rematch' : 'multiplayer-decline-rematch'
      )
      .tap();
    const own = await signedInAccountOf(s, 'bob');
    await pollUntil(
      s,
      async () => {
        const game = (await multiplayerView(s, 'bob')).game;
        return game !== null && game.rematch_offer_by !== own ? true : null;
      },
      { maxMs: 10_000, description: "Bob's answer is taken" }
    );
  },
});

const SECOND_MS = 1000;

/** What the model names, from what Bob sees of Cedar and their games. */
export async function observeHumanLikePlay(s: ProductHarness) {
  const moves = movesSeenBy(s, 'bob');
  const seconds = moves.map((move) => Math.floor(move.thinkingMs / SECOND_MS));
  const bob = await signedInAccountOf(s, 'bob');
  const cedar = (await cedarUser(s)).account_id;
  const games = await s.harness.serverSql.sqlClient.query(
    sql<{
      id: string;
    }>`SELECT id FROM chess_multiplayer_games WHERE ((white_id = ${bob} AND black_id = ${cedar}) OR (white_id = ${cedar} AND black_id = ${bob})) AND deleted_at IS NULL`
  );
  return {
    thinkingTimeHumanLike: moves.every(
      (move) =>
        move.thinkingMs >= 2 * SECOND_MS && move.thinkingMs <= 20 * SECOND_MS
    ),
    thinkingTimeChanged: seconds.every(
      (value, index) => index === 0 || value !== seconds[index - 1]
    ),
    gamesInARow: games.length,
  };
}
