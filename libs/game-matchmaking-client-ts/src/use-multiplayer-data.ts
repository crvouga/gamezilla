import { useMyId } from '@libs/auth-client-ts/use-current-user';
import type { MultiplayerGame } from '@libs/game-matchmaking-shared-ts/game-state';
import { MULTIPLAYER_GAME_COLUMNS } from '@libs/game-matchmaking-shared-ts/game-state';
import type { MatchRoomGame } from '@libs/game-matchmaking-shared-ts/match-room';
import { multiplayerSideOf } from '@libs/game-matchmaking-shared-ts/multiplayer-roster';
import { useSpaceRoomSessionId } from '@libs/spaces-client-ts/space-room-context';
import sql, { raw } from '@pkgs/sql-root-shared-ts/sql';
import {
  createQuery,
  useSyncEngineInstance,
} from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { createEffect, onCleanup } from 'solid-js';
import { matchingMultiplayerRoomGame } from './multiplayer-room-game';
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
  candidate: MatchRoomGame | null
): MultiplayerGame {
  const room = matchingMultiplayerRoomGame(row, candidate);
  if (room === null) return row;
  // A room delivery may omit untimed fields; explicit nulls remain authoritative.
  const defined = Object.fromEntries(
    Object.entries(room).filter(([, value]) => value !== undefined)
  );
  return { ...row, ...defined };
}

/**
 * The space's host's search and game, including a game watched by guests.
 * Both belong to the account, whichever game they are of; `gameId` is the
 * game a new search from this screen is for.
 */
export function useMultiplayerData(gameId: () => string) {
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
    return row === null ? null : withRoom(row, roomGame.game());
  };
  return {
    gameId,
    myId,
    spaceId,
    hostId,
    game,
    room: roomGame.room,
    execution: () =>
      matchingMultiplayerRoomGame(games.rows()[0] ?? null, roomGame.game())
        ?.execution,
    search: () => searches.rows()[0] ?? null,
    ratings: ratings.rows,
    participant: () => {
      const current = game();
      return current !== null && multiplayerSideOf(current, myId()) !== null;
    },
    loading: games.isLoading,
  };
}

export type MultiplayerData = ReturnType<typeof useMultiplayerData>;
