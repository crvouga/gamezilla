import { useMyId } from '@libs/auth-client/use-current-user';
import type { MultiplayerGame } from '@libs/chess-matchmaking-shared/game-state';
import { MULTIPLAYER_GAME_COLUMNS } from '@libs/chess-matchmaking-shared/game-state';
import type { MatchRoomGame } from '@libs/chess-matchmaking-shared/match-room';
import { useSpaceRoomSessionId } from '@libs/spaces-client/space-room-context';
import sql, { raw } from '@pkgs/sql-root-shared/sql';
import {
  createQuery,
  useSyncEngineInstance,
} from '@pkgs/sync-engine-client/sync-engine-context';
import { createEffect, onCleanup } from 'solid-js';
import { useMatchRoom } from './use-match-room';

export type MultiplayerSearchRow = {
  readonly search_id: string;
  readonly standing: string;
  readonly time_control: string | null;
  readonly joined_at_ms: number | null;
};

export type MultiplayerRatingRow = {
  readonly speed: string;
  readonly rating: number;
  readonly games: number;
};

const GAME_COLUMNS = raw(
  MULTIPLAYER_GAME_COLUMNS.map((column) => `g.${column}`).join(', ')
);

function withRoom(
  row: MultiplayerGame,
  room: MatchRoomGame | null
): MultiplayerGame {
  if (room === null || room.id !== row.id || room.revision < row.revision)
    return row;
  return {
    ...row,
    white_id: room.white_id,
    black_id: room.black_id,
    fen: room.fen,
    pgn: room.pgn,
    revision: room.revision,
    turn: room.turn,
    outcome: room.outcome,
    reason: room.reason,
    paused_at_ms: room.paused_at_ms,
    ...(room.time_control !== undefined
      ? { time_control: room.time_control }
      : {}),
    ...(room.white_ms !== undefined ? { white_ms: room.white_ms } : {}),
    ...(room.black_ms !== undefined ? { black_ms: room.black_ms } : {}),
    ...(room.clock_at_ms !== undefined
      ? { clock_at_ms: room.clock_at_ms }
      : {}),
    ...(room.draw_offer_by !== undefined
      ? { draw_offer_by: room.draw_offer_by }
      : {}),
    ...(room.rematch_offer_by !== undefined
      ? { rematch_offer_by: room.rematch_offer_by }
      : {}),
    ...(room.rematch_of !== undefined ? { rematch_of: room.rematch_of } : {}),
    ...(room.white_rating !== undefined
      ? { white_rating: room.white_rating }
      : {}),
    ...(room.black_rating !== undefined
      ? { black_rating: room.black_rating }
      : {}),
    ...(room.white_rating_diff !== undefined
      ? { white_rating_diff: room.white_rating_diff }
      : {}),
    ...(room.black_rating_diff !== undefined
      ? { black_rating_diff: room.black_rating_diff }
      : {}),
  };
}

/** The space's host's search and game, including a game watched by guests. */
export function useMultiplayerData() {
  const myId = useMyId();
  const spaceId = useSpaceRoomSessionId();
  const sync = useSyncEngineInstance();
  const spaces = createQuery(
    () =>
      sql<{
        host_member_id: string;
      }>`SELECT host_member_id FROM spaces WHERE id = ${spaceId() ?? ''} AND deleted_at IS NULL AND ended_at IS NULL`
  );
  const hostId = () => spaces.rows()[0]?.host_member_id ?? '';
  const games = createQuery(
    () => sql<MultiplayerGame>`SELECT ${GAME_COLUMNS} FROM chess_multiplayer_games AS g
    JOIN chess_multiplayer_players AS p ON p.game_id = g.id
    WHERE p.owner_id = ${hostId()} AND p.deleted_at IS NULL AND g.deleted_at IS NULL`
  );
  const searches = createQuery(
    () => sql<MultiplayerSearchRow>`
    SELECT search_id, standing, time_control, joined_at_ms FROM chess_opponent_searches
    WHERE owner_id = ${hostId()} AND deleted_at IS NULL`
  );
  const ratings = createQuery(
    () => sql<MultiplayerRatingRow>`SELECT speed, rating, games FROM chess_multiplayer_ratings
    WHERE owner_id = ${myId()} AND deleted_at IS NULL`
  );
  createEffect(() => {
    const id = spaceId();
    if (!id) return;
    const held = sync.subscribeQueries([
      { name: 'chessMultiplayerSpace', params: { spaceId: id } },
    ]);
    onCleanup(() => held.unsubscribe());
    void sync.refreshQueries();
  });
  const roomGame = useMatchRoom(() => games.rows()[0]?.id);
  const game = () => {
    const row = games.rows()[0] ?? null;
    return row === null ? null : withRoom(row, roomGame());
  };
  return {
    myId,
    spaceId,
    hostId,
    game,
    search: () => searches.rows()[0] ?? null,
    ratings: ratings.rows,
    participant: () => {
      const current = game();
      return (
        current !== null &&
        (current.white_id === myId() || current.black_id === myId())
      );
    },
    loading: games.isLoading,
  };
}

export type MultiplayerData = ReturnType<typeof useMultiplayerData>;
