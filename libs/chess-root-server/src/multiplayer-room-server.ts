import {
  MATCH_ROOM_MODULE,
  MultiplayerGameChanged,
  matchRoomTopic,
} from '@libs/chess-matchmaking-shared/match-room';
import { decideOnServer } from '@libs/permissions-server/decide-on-server';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { spaceRoomMembershipChanged } from '@libs/spaces-shared/space-withdrawal';
import { storedSpacePresence } from '@libs/spaces-shared/stored-space-presence';
import type { RoomGrantsCtx } from '@libs/sub-shared/server';
import type { OutboxConsumerRegistry } from '@pkgs/outbox-shared/define-consumer';
import type { RoomServicePort } from '@pkgs/room-root-shared/room-service';
import sql from '@pkgs/sql-root-shared/sql';

/** Membership in either host's open space permits watching the same match. */
export async function multiplayerRoomGrants(
  ctx: RoomGrantsCtx
): Promise<readonly string[]> {
  if (!ctx.topic.startsWith(`${MATCH_ROOM_MODULE}:`)) return [];
  const gameId = ctx.topic.slice(MATCH_ROOM_MODULE.length + 1);
  const spaces = await ctx.db.query(sql<{
    id: string;
  }>`SELECT s.id FROM spaces AS s
    JOIN chess_multiplayer_players AS p ON p.owner_id = s.host_member_id
    WHERE p.game_id = ${gameId} AND p.deleted_at IS NULL AND s.deleted_at IS NULL AND s.ended_at IS NULL`);
  for (const space of spaces) {
    const spacePresence = await storedSpacePresence(
      ctx.db,
      space.id,
      ctx.actor
    );
    const decision = await decideOnServer(ctx.db, {
      actor: ctx.actor,
      key: PERMISSION.chessMultiplayerWatch,
      nowMs: ctx.nowMs,
      scope: { spacePresence },
    });
    if (decision.allowed) return [PERMISSION.chessMultiplayerWatch];
  }
  return [];
}

export function registerMatchRoomConsumers(
  registry: OutboxConsumerRegistry,
  rooms: RoomServicePort
): void {
  registry.register({
    id: 'chess.match-room-state',
    on: MultiplayerGameChanged,
    handler: async (ctx, game) => {
      // Read the latest committed projection so delayed deliveries cannot restore
      // an earlier board, result or erased identity.
      const rows = await ctx.tx.query(sql<
        typeof game
      >`SELECT id, white_id, black_id, fen, pgn, revision, turn, outcome, reason,
        time_control, white_ms, black_ms, clock_at_ms, paused_at_ms, draw_offer_by, rematch_offer_by,
        rematch_of, white_rating, black_rating, white_rating_diff, black_rating_diff
        FROM chess_multiplayer_games WHERE id = ${game.id} AND deleted_at IS NULL`);
      const current = rows[0];
      if (current !== undefined)
        await rooms.send(
          matchRoomTopic(game.id),
          `match:${ctx.createId()}`,
          MultiplayerGameChanged(current)
        );
    },
  });
  registry.register({
    id: 'chess.match-room-membership',
    on: spaceRoomMembershipChanged,
    handler: async (ctx, change) => {
      if (change.change === 'joined') return;
      const games = await ctx.tx.query(sql<{
        game_id: string;
      }>`SELECT p.game_id FROM chess_multiplayer_players AS p
        JOIN spaces AS s ON s.host_member_id = p.owner_id WHERE s.id = ${change.spaceId}`);
      for (const game of games)
        await rooms.disconnect(
          matchRoomTopic(game.game_id),
          change.change === 'ended' ? null : change.memberId
        );
    },
  });
}
