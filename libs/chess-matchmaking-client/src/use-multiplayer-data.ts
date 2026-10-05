import { useMyId } from '@libs/auth-client/use-current-user';
import type { MultiplayerGame } from '@libs/chess-matchmaking-shared/game-state';
import { MULTIPLAYER_GAME_COLUMNS } from '@libs/chess-matchmaking-shared/game-state';
import sql, { raw } from '@pkgs/sql-root-shared/sql';
import {
  createQuery,
  useSyncEngineInstance,
} from '@pkgs/sync-engine-client/sync-engine-context';
import { type Accessor, createEffect, onCleanup, onMount } from 'solid-js';

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

export function useMultiplayerData(
  requestedGame: Accessor<string | undefined>
) {
  const myId = useMyId();
  const sync = useSyncEngineInstance();
  // Opening a private game is an explicit recovery event, including changes
  // to the opponent's public profile while this screen was away.
  onMount(() => {
    void sync.refreshQueries();
  });
  const games = createQuery(
    () => sql<MultiplayerGame>`SELECT ${GAME_COLUMNS} FROM chess_multiplayer_games AS g
    WHERE (g.white_id = ${myId()} OR g.black_id = ${myId()}) AND g.deleted_at IS NULL
      AND g.id = ${requestedGame() ?? ''}
    UNION ALL SELECT ${GAME_COLUMNS}
    FROM chess_multiplayer_games AS g JOIN chess_multiplayer_players AS p ON p.game_id = g.id
    WHERE p.owner_id = ${myId()} AND p.deleted_at IS NULL AND g.deleted_at IS NULL
      AND (g.white_id = ${myId()} OR g.black_id = ${myId()}) AND ${requestedGame() ?? ''} = ''`
  );
  const searches = createQuery(
    () => sql<MultiplayerSearchRow>`
    SELECT search_id, standing, time_control, joined_at_ms FROM chess_opponent_searches
    WHERE owner_id = ${myId()} AND deleted_at IS NULL`
  );
  const ratings = createQuery(
    () => sql<MultiplayerRatingRow>`SELECT speed, rating, games FROM chess_multiplayer_ratings
    WHERE owner_id = ${myId()} AND deleted_at IS NULL`
  );
  createEffect(() => {
    const gameId = requestedGame();
    if (gameId === undefined || gameId.length === 0) return;
    const held = sync.subscribeQueries([
      { name: 'chessMultiplayerGame', params: { gameId } },
    ]);
    onCleanup(() => held.unsubscribe());
  });
  return {
    myId,
    game: () => games.rows()[0] ?? null,
    search: () => searches.rows()[0] ?? null,
    ratings: ratings.rows,
    loading: games.isLoading,
  };
}

export type MultiplayerData = ReturnType<typeof useMultiplayerData>;
