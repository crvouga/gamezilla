import { useMyId } from '@libs/auth-client/use-current-user';
import type { MultiplayerGame } from '@libs/chess-matchmaking-shared/game';
import { useSpaceRoomSessionId } from '@libs/spaces-client/space-room-context';
import sql from '@pkgs/sql-root-shared/sql';
import { createQuery, useSyncEngineInstance } from '@pkgs/sync-engine-client/sync-engine-context';
import { createEffect, onCleanup } from 'solid-js';
import { useMatchRoom } from './use-match-room';

export function useMultiplayerData() {
  const myId = useMyId();
  const spaceId = useSpaceRoomSessionId();
  const sync = useSyncEngineInstance();
  const spaces = createQuery(() => sql<{ host_member_id: string }>`SELECT host_member_id FROM spaces WHERE id = ${spaceId() ?? ''} AND deleted_at IS NULL AND ended_at IS NULL`);
  const hostId = () => spaces.rows()[0]?.host_member_id ?? '';
  const games = createQuery(() => sql<MultiplayerGame>`SELECT g.id, g.white_id, g.black_id, g.fen, g.pgn,
    g.revision, g.turn, g.outcome, g.reason FROM chess_multiplayer_games AS g
    JOIN chess_multiplayer_players AS p ON p.game_id = g.id
    WHERE p.owner_id = ${hostId()} AND p.deleted_at IS NULL AND g.deleted_at IS NULL`);
  const searches = createQuery(() => sql<{ search_id: string; standing: string }>`SELECT search_id, standing
    FROM chess_opponent_searches WHERE owner_id = ${hostId()} AND deleted_at IS NULL`);
  createEffect(() => {
    const id = spaceId();
    if (!id) return;
    const held = sync.subscribeQueries([{ name: 'chessMultiplayerSpace', params: { spaceId: id } }]);
    onCleanup(() => held.unsubscribe());
    void sync.refreshQueries();
  });
  const roomGame = useMatchRoom(() => games.rows()[0]?.id);
  const game = () => roomGame();
  return { myId, spaceId, hostId, game, search: () => searches.rows()[0] ?? null,
    participant: () => game()?.white_id === myId() || game()?.black_id === myId(),
    loading: games.isLoading };
}
