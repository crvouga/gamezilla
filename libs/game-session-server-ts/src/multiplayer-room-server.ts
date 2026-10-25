import { MULTIPLAYER_GAME_COLUMNS } from '@libs/game-matchmaking-shared-ts/game-state';
import {
  MATCH_ROOM_MODULE,
  MultiplayerGameChanged,
  matchRoomTopic,
} from '@libs/game-matchmaking-shared-ts/match-room';
import { decideOnServer } from '@libs/permissions-server-ts/decide-on-server';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { spaceRoomMembershipChanged } from '@libs/spaces-shared-ts/space-withdrawal';
import { storedSpacePresence } from '@libs/spaces-shared-ts/stored-space-presence';
import type { RoomGrantsCtx } from '@libs/sub-shared-ts/server';
import type { OutboxConsumerRegistry } from '@pkgs/outbox-shared-ts/define-consumer';
import type { RoomServicePort } from '@pkgs/room-root-shared-ts/room-service';
import sql, { raw } from '@pkgs/sql-root-shared-ts/sql';

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
    const grants: string[] = [];
    for (const key of [
      PERMISSION.gameMultiplayerWatch,
      PERMISSION.gameMultiplayerPlay,
    ]) {
      const decision = await decideOnServer(ctx.db, {
        actor: ctx.actor,
        key,
        nowMs: ctx.nowMs,
        scope: { spacePresence },
      });
      if (decision.allowed) grants.push(key);
    }
    if (grants.includes(PERMISSION.gameMultiplayerWatch)) return grants;
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
      >`SELECT ${raw(MULTIPLAYER_GAME_COLUMNS.join(', '))}
        FROM chess_multiplayer_games WHERE id = ${game.id} AND deleted_at IS NULL`);
      const current = rows[0];
      if (current !== undefined) {
        const receipt = await rooms.send(
          matchRoomTopic(game.id),
          `match:${ctx.createId()}`,
          MultiplayerGameChanged(current)
        );
        if (!receipt.ok)
          throw new Error('matched room refused its SQL projection');
      }
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
