import { useMyId } from '@libs/auth/public/use-current-user';
import { sql } from '@pkgs/sql';
import { createQuery, useSyncEngineInstance } from '@pkgs/sync-engine/solid';
import { type Accessor, createEffect, onCleanup, onMount } from 'solid-js';
import type { MultiplayerGame } from '../../shared/multiplayer/game';

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
    () => sql<MultiplayerGame>`SELECT g.id, g.white_id, g.black_id, g.fen, g.pgn,
    g.revision, g.turn, g.outcome, g.reason FROM chess_multiplayer_games AS g
    WHERE (g.white_id = ${myId()} OR g.black_id = ${myId()}) AND g.deleted_at IS NULL
      AND g.id = ${requestedGame() ?? ''}
    UNION ALL SELECT g.id, g.white_id, g.black_id, g.fen, g.pgn, g.revision, g.turn, g.outcome, g.reason
    FROM chess_multiplayer_games AS g JOIN chess_multiplayer_players AS p ON p.game_id = g.id
    WHERE p.owner_id = ${myId()} AND p.deleted_at IS NULL AND g.deleted_at IS NULL
      AND (g.white_id = ${myId()} OR g.black_id = ${myId()}) AND ${requestedGame() ?? ''} = ''`
  );
  const searches = createQuery(
    () => sql<{ search_id: string; standing: string }>`
    SELECT search_id, standing FROM chess_opponent_searches WHERE owner_id = ${myId()} AND deleted_at IS NULL`
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
    loading: games.isLoading,
  };
}
