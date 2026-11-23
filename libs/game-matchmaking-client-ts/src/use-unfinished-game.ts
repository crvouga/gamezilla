import { useMyId } from '@libs/auth-client-ts/use-current-user';
import { multiplayerLinkRoute } from '@libs/game-matchmaking-shared-ts/multiplayer-link';
import { spaceDetailHref } from '@libs/spaces-client-ts/space-routes';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { createQuery } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { useTurnGames } from '@pkgs/turn-game-client-ts/turn-games-context';
import { type Accessor, createMemo } from 'solid-js';

/**
 * The person's unfinished game, wherever it is played: a custom game under
 * way that they sit in, or their unfinished matched game. A person has at
 * most one (`specs/games/unfinished-game-limit.dmn`).
 */
export type UnfinishedGame =
  | {
      readonly kind: 'custom';
      /** The space the custom game is played in. */
      readonly spaceId: string;
      /** Where returning to it leads. */
      readonly href: string;
    }
  | {
      readonly kind: 'matched';
      /** The game it is a game of. */
      readonly gameId: string;
      readonly href: string;
    };

type SeatRow = { readonly space_id: string };
type MatchedRow = { readonly fen: string };

/**
 * Read on every device of the person from what they hold: their seat in a
 * custom game under way (`chess_custom_game_seats`, kept from the space's
 * room) and their own matched game.
 */
export function useUnfinishedGame(): Accessor<UnfinishedGame | null> {
  const myId = useMyId();
  const rules = useTurnGames();
  const seats = createQuery(
    () => sql<SeatRow>`
      SELECT c.space_id FROM chess_custom_game_seats AS c
      LEFT JOIN spaces AS s ON s.id = c.space_id
      WHERE c.owner_id = ${myId()} AND c.under_way = ${true}
        AND c.deleted_at IS NULL
        AND (s.id IS NULL OR (s.ended_at IS NULL AND s.deleted_at IS NULL))
      ORDER BY c.updated_at DESC
      LIMIT 1`
  );
  const matched = createQuery(
    () => sql<MatchedRow>`
      SELECT g.fen FROM chess_multiplayer_games AS g
      JOIN chess_multiplayer_players AS p ON p.game_id = g.id
      WHERE p.owner_id = ${myId()} AND p.deleted_at IS NULL
        AND g.deleted_at IS NULL AND g.outcome = ${'ongoing'}
      LIMIT 1`
  );
  return createMemo((): UnfinishedGame | null => {
    if (myId().length === 0) return null;
    const seat = seats.rows()[0];
    if (seat !== undefined)
      return {
        kind: 'custom',
        spaceId: seat.space_id,
        href: spaceDetailHref(seat.space_id),
      };
    const game = matched.rows()[0];
    if (game === undefined) return null;
    const gameId = rules.forPosition(game.fen).id;
    return { kind: 'matched', gameId, href: multiplayerLinkRoute(gameId) };
  });
}
