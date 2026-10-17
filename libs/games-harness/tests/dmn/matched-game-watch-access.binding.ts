import { MATCH_ROOM_MODULE } from '@libs/game-matchmaking-shared/match-room';
import { MULTIPLAYER_TABLES } from '@libs/game-matchmaking-shared/multiplayer-tables';
import type { HarnessGame } from '@libs/game-session-harness/harness-game';
import { multiplayerRoomGrants } from '@libs/game-session-server/multiplayer-room-server';
import { clientGatingLayer } from '@libs/permissions-harness/client';
import { spaceRolesApplicationLayer } from '@libs/permissions-shared/application';
import { DMN_INPUT } from '@libs/permissions-shared/people';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import type { ServerCase } from '@libs/permissions-shared/server';
import {
  OperationRefused,
  serverEnforcementLayer,
} from '@libs/permissions-shared/server';
import { useSpaceCan } from '@libs/spaces-client/use-space-can';
import {
  memberIdOf,
  SPACE_ID,
  SPACE_TABLES,
  seedPlaceInSpace,
  seedPlaceInSpaceOnDevice,
} from '@libs/spaces-harness/space-decision-world';
import type { DecisionLayer } from '@pkgs/dmn-shared/registry';
import { bindDecisions } from '@pkgs/dmn-shared/registry';
import sql from '@pkgs/sql-root-shared/sql';
import { gamesHeldTo } from '../conformance-world';

/** Every game the table holds for. */
const GAMES = gamesHeldTo('specs/games/matched-game-watch-access.dmn');

/** The host's matched game of `game`, which the case asks to watch. */
const watchedGame = (game: HarnessGame) => `watched-${game.shared.id}`;

/** The space's host plays one matched game of `game` from that space. */
function seedWatchedGame(game: HarnessGame) {
  return async (c: ServerCase) => {
    await seedPlaceInSpace(c);
    const id = watchedGame(game);
    const stamp = c.env.now().toISOString();
    await c.db.run(sql`INSERT INTO chess_multiplayer_games
      (id, match_id, white_id, black_id, fen, pgn, revision, turn, outcome, reason, created_at, updated_at, deleted_at)
      SELECT ${id}, ${`match-${id}`}, host_member_id, ${'opponent'}, ${game.shared.turnGame.rules.initial()},
        ${''}, ${0}, host_member_id, ${'ongoing'}, ${null}, ${stamp}, ${stamp}, ${null}
      FROM spaces WHERE id = ${SPACE_ID}`);
    await c.db.run(sql`INSERT INTO chess_multiplayer_players (id, owner_id, game_id)
      SELECT ${`player-${id}`}, host_member_id, ${id} FROM spaces WHERE id = ${SPACE_ID}`);
  };
}

/**
 * The server's grant for watching `game`'s matched game from its room: each
 * game is its own layer, so every case runs through every game.
 */
function serverEnforcementIn(game: HarnessGame): DecisionLayer {
  return serverEnforcementLayer({
    tables: [...SPACE_TABLES, ...MULTIPLAYER_TABLES],
    seed: seedWatchedGame(game),
    operationFor: () => async (c) => {
      const grants = await multiplayerRoomGrants({
        db: c.db,
        topic: `${MATCH_ROOM_MODULE}:${watchedGame(game)}`,
        nowMs: c.nowMs,
        actor: {
          memberId: memberIdOf(c),
          accountId: c.env.accountId ?? null,
          deviceId: c.env.deviceId!,
        },
      });
      if (!grants.includes(PERMISSION.gameMultiplayerWatch))
        throw new OperationRefused('not in the space');
    },
  });
}

const application = spaceRolesApplicationLayer();
bindDecisions({
  spec: 'matched-game-watch-access',
  layers: {
    'application decision': {
      observes: ['answer'],
      decide: (input, context) =>
        application.decide(
          { ...input, [DMN_INPUT.capability]: 'watch a matched game' },
          context
        ),
    },
    ...Object.fromEntries(
      GAMES.map((game) => [
        `server enforcement in ${game.label}`,
        serverEnforcementIn(game),
      ])
    ),
    'client gating': clientGatingLayer({
      tables: SPACE_TABLES,
      seed: seedPlaceInSpaceOnDevice,
      probe: () => {
        const can = useSpaceCan(SPACE_ID, PERMISSION.gameMultiplayerWatch);
        return () => ({ answer: can() ? 'yes' : 'no' });
      },
    }),
  },
});
